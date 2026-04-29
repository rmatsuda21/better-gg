import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { mapSeedsByPlaceholder, mapSeedsByProgressionId } from '../lib/projection-utils'
import type { OriginSeedEntrant } from '../lib/projection-utils'
import type { BracketEntrant } from '../lib/bracket-utils'
import { buildBracketData, buildProjectedResults, getWinnerFromProjected, getLoserFromProjected, resolveEntrantDisplay } from '../lib/bracket-utils'
import { fetchOriginPhaseSetsByPg, phaseSetsByPhaseIdsKey } from './use-bracket-sets'
import { fetchPhaseSeeds, phaseSeedsQueryKey, type PhaseSeedNode } from '../lib/phase-seeds'
import { STALE_TIME_MS } from '../lib/constants'

interface DestinationSeed {
  seedNum: number
  progressionSeedId: number | null
  placeholderName: string | null
  entrant: OriginSeedEntrant | null
}

export interface CrossPhaseOverrides {
  seedOverrides: Map<number, BracketEntrant>
  seedIdToSeedNum: Map<string, number>
}

/** Fetch via React Query cache so repeated calls (across hooks/strategies) dedupe. */
function fetchPhaseSeedsCached(queryClient: QueryClient, phaseId: string) {
  return queryClient.fetchQuery({
    queryKey: phaseSeedsQueryKey(phaseId),
    queryFn: () => fetchPhaseSeeds(phaseId),
    staleTime: STALE_TIME_MS.BRACKET,
  })
}

/**
 * Fetch every set in a phase via `event.sets(filters: { phaseIds })` (one paginated
 * chain) and group results by phase group. Replaces N parallel per-PG queries with
 * a single phase-level fetch — important for large origin phases (e.g., 5+ pools).
 */
function fetchOriginPhaseSetsCached(
  queryClient: QueryClient,
  eventId: string,
  originPhaseId: string,
  phaseName: string | null,
  phaseOrder: number | null,
) {
  return queryClient.fetchQuery({
    queryKey: phaseSetsByPhaseIdsKey(eventId, originPhaseId),
    queryFn: () => fetchOriginPhaseSetsByPg(eventId, originPhaseId, phaseName, phaseOrder),
    staleTime: STALE_TIME_MS.BRACKET,
  })
}

/** Extract the origin phase ID from seed nodes' progressionSource */
function findOriginPhaseId(seedNodes: Array<PhaseSeedNode | null>): string | null {
  for (const node of seedNodes) {
    const originId = node?.progressionSource?.originPhase?.id
    if (originId != null) return String(originId)
  }
  return null
}

/**
 * Recursively resolve projected entrants for an empty phase by walking
 * the progression chain via placeholderName until a phase with entrants is found.
 */
async function resolveProjectionChain(
  queryClient: QueryClient,
  destSeeds: DestinationSeed[],
  originPhaseId: string,
  maxDepth = 5,
  isTeamEvent?: boolean,
): Promise<Map<number, OriginSeedEntrant> | null> {
  if (maxDepth <= 0) return null

  const originSeedNodes = await fetchPhaseSeedsCached(queryClient, originPhaseId)
  const hasEntrants = originSeedNodes.some(n => n?.entrant?.id != null)

  if (hasEntrants) {
    const originSeedsRaw = originSeedNodes
      .filter((n): n is NonNullable<typeof n> => n?.id != null && n?.seedNum != null)
      .map(n => {
        const display = n.entrant?.id ? resolveEntrantDisplay(n.entrant, !!isTeamEvent) : null
        return {
          id: n.id!,
          seedNum: n.seedNum!,
          progressionSeedId: n.progressionSeedId ?? null,
          groupDisplayId: n.phaseGroup?.displayIdentifier ?? null,
          entrant: display ? {
            id: String(n.entrant!.id),
            name: display.name,
            prefix: display.prefix,
            seedNum: n.seedNum ?? n.entrant!.initialSeedNum ?? null,
          } : null,
        }
      })

    // Merge both strategies: placeholder provides baseline, progressionSeedId overrides
    const result = mapSeedsByPlaceholder(destSeeds, originSeedsRaw)
    for (const [k, v] of mapSeedsByProgressionId(destSeeds, originSeedsRaw)) {
      result.set(k, v)
    }
    return result.size > 0 ? result : null
  }

  // Origin phase ALSO has no entrants — recurse deeper
  const deeperOriginId = findOriginPhaseId(originSeedNodes)
  if (!deeperOriginId) return null

  const intermediateDest: DestinationSeed[] = originSeedNodes
    .filter((n): n is NonNullable<typeof n> => n?.seedNum != null)
    .map(n => ({
      seedNum: n.seedNum!,
      progressionSeedId: n.progressionSeedId ?? null,
      placeholderName: n.placeholderName ?? null,
      entrant: null,
    }))

  const deeperOverrides = await resolveProjectionChain(queryClient, intermediateDest, deeperOriginId, maxDepth - 1, isTeamEvent)
  if (!deeperOverrides || deeperOverrides.size === 0) return null

  const resolvedOriginSeeds = originSeedNodes
    .filter((n): n is NonNullable<typeof n> => n?.id != null && n?.seedNum != null)
    .map(n => {
      const override = deeperOverrides.get(n.seedNum!)
      return {
        id: n.id!,
        seedNum: n.seedNum!,
        groupDisplayId: n.phaseGroup?.displayIdentifier ?? null,
        entrant: override ?? null,
      }
    })

  const result = mapSeedsByPlaceholder(destSeeds, resolvedOriginSeeds)
  for (const [k, v] of mapSeedsByProgressionId(destSeeds, resolvedOriginSeeds)) {
    result.set(k, v)
  }
  return result.size > 0 ? result : null
}

/**
 * Lazy hook: resolves cross-phase seed overrides for empty CREATED phases.
 * Only fetches data when `enabled` is true (user toggled Projected + phase has origins).
 */
export function useCrossPhaseOverrides(
  phaseId: string,
  originPhaseIds: string[],
  phaseName: string | null,
  phaseOrder: number | null,
  enabled: boolean,
  isTeamEvent?: boolean,
  eventId?: string | null,
) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['crossPhaseOverrides', phaseId, originPhaseIds, eventId ?? null],
    queryFn: async (): Promise<CrossPhaseOverrides> => {
      // Fetch destination seeds for this phase (cached/deduped)
      const destSeedNodes = await fetchPhaseSeedsCached(queryClient, phaseId)

      // Build seedIdToSeedNum map
      const seedIdToSeedNum = new Map<string, number>()
      const destinationSeeds: DestinationSeed[] = []

      for (const node of destSeedNodes) {
        if (node?.seedNum == null) continue
        if (node.id != null) {
          seedIdToSeedNum.set(String(node.id), node.seedNum)
        }
        const entDisplay = node.entrant?.id ? resolveEntrantDisplay(node.entrant, !!isTeamEvent) : null
        destinationSeeds.push({
          seedNum: node.seedNum,
          progressionSeedId: node.progressionSeedId ?? null,
          placeholderName: node.placeholderName ?? null,
          entrant: entDisplay ? {
            id: String(node.entrant!.id),
            name: entDisplay.name,
            prefix: entDisplay.prefix,
            seedNum: node.seedNum,
          } : null,
        })
      }

      // Discover additional origin phase IDs from destination seeds
      const effectiveOriginIds = [...originPhaseIds]
      if (effectiveOriginIds.length === 0) {
        for (const node of destSeedNodes) {
          const originId = node?.progressionSource?.originPhase?.id
          if (originId != null) {
            effectiveOriginIds.push(String(originId))
            break
          }
        }
      }

      const overrides = new Map<number, BracketEntrant>()

      // Strategy 1: Recursive projection chain (handles multi-level empty phases)
      if (effectiveOriginIds.length > 0 && destinationSeeds.length > 0) {
        const chainOverrides = await resolveProjectionChain(queryClient, destinationSeeds, effectiveOriginIds[0], 5, isTeamEvent)
        if (chainOverrides) {
          for (const [seedNum, entrant] of chainOverrides) {
            overrides.set(seedNum, {
              id: entrant.id,
              name: entrant.name,
              prefix: entrant.prefix,
              seedNum,
              isProjected: true,
            })
          }
        }
      }

      // Strategy 2: progressionMap-based fallback (for ACTIVE/COMPLETED origins)
      if (overrides.size < destinationSeeds.length && effectiveOriginIds.length > 0 && eventId) {
        const originPhaseId = effectiveOriginIds[0]

        // Single phase-level fetch (paginated) returns sets for all PGs in the
        // origin phase. Replaces N parallel per-PG queries.
        const pgResultsByPgId = await fetchOriginPhaseSetsCached(
          queryClient,
          eventId,
          originPhaseId,
          phaseName,
          phaseOrder,
        )

        for (const pgResult of pgResultsByPgId.values()) {
          const bracket = buildBracketData(pgResult.pgInfo)
          const projected = buildProjectedResults(bracket)

          for (const [setId, progInfo] of pgResult.progressionMap) {
            if (progInfo.loserPhase?.id === phaseId && progInfo.loserSeedNum != null && !overrides.has(progInfo.loserSeedNum)) {
              const projSet = projected.get(setId)
              if (projSet) {
                const loser = getLoserFromProjected(projSet)
                if (loser) {
                  overrides.set(progInfo.loserSeedNum, { ...loser, seedNum: progInfo.loserSeedNum, isProjected: true })
                }
              }
            }
            if (progInfo.winnerPhase?.id === phaseId && progInfo.winnerSeedNum != null && !overrides.has(progInfo.winnerSeedNum)) {
              const projSet = projected.get(setId)
              if (projSet) {
                const winner = getWinnerFromProjected(projSet)
                if (winner) {
                  overrides.set(progInfo.winnerSeedNum, { ...winner, seedNum: progInfo.winnerSeedNum, isProjected: true })
                }
              }
            }
          }
        }
      }

      return { seedOverrides: overrides, seedIdToSeedNum }
    },
    enabled: enabled && !!phaseId,
    staleTime: STALE_TIME_MS.BRACKET,
  })
}
