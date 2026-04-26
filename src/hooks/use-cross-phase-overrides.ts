import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { mapSeedsByPlaceholder, mapSeedsByProgressionId } from '../lib/projection-utils'
import type { OriginSeedEntrant } from '../lib/projection-utils'
import type { BracketEntrant } from '../lib/bracket-utils'
import { buildBracketData, buildProjectedResults, getWinnerFromProjected, getLoserFromProjected } from '../lib/bracket-utils'
import { fetchPhaseGroupSetData } from './use-bracket-sets'

// Fetch phase seeds with progression data for cross-phase projection
const phaseSeedsQuery = graphql(`
  query PhaseSeeds($phaseId: ID!, $page: Int!, $perPage: Int!) {
    phase(id: $phaseId) {
      seeds(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          seedNum
          progressionSeedId
          placeholderName
          phaseGroup {
            id
            displayIdentifier
          }
          progressionSource {
            id
            originPhase { id name }
          }
          entrant {
            id
            name
            initialSeedNum
            participants {
              id
              gamerTag
              prefix
              player { id }
            }
          }
        }
      }
    }
  }
`)

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

type SeedNode = NonNullable<Awaited<ReturnType<typeof fetchPhaseSeeds>>[number]>

async function fetchPhaseSeeds(phaseId: string, perPage = 80) {
  const firstPage = await graphqlClient.request(phaseSeedsQuery, {
    phaseId,
    page: 1,
    perPage,
  })

  const allNodes = [...(firstPage.phase?.seeds?.nodes ?? [])]
  const totalPages = firstPage.phase?.seeds?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(phaseSeedsQuery, {
          phaseId,
          page: i + 2,
          perPage,
        })
      )
    )
    for (const r of remaining) {
      allNodes.push(...(r.phase?.seeds?.nodes ?? []))
    }
  }

  return allNodes
}

/** Extract the origin phase ID from seed nodes' progressionSource */
function findOriginPhaseId(seedNodes: Array<SeedNode | null>): string | null {
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
  destSeeds: DestinationSeed[],
  originPhaseId: string,
  maxDepth = 5,
): Promise<Map<number, OriginSeedEntrant> | null> {
  if (maxDepth <= 0) return null

  const originSeedNodes = await fetchPhaseSeeds(originPhaseId)
  const hasEntrants = originSeedNodes.some(n => n?.entrant?.id != null)

  if (hasEntrants) {
    const originSeedsRaw = originSeedNodes
      .filter((n): n is NonNullable<typeof n> => n?.id != null && n?.seedNum != null)
      .map(n => ({
        id: n.id!,
        seedNum: n.seedNum!,
        progressionSeedId: n.progressionSeedId ?? null,
        groupDisplayId: n.phaseGroup?.displayIdentifier ?? null,
        entrant: n.entrant?.id ? {
          id: String(n.entrant.id),
          name: n.entrant.participants?.[0]?.gamerTag ?? n.entrant.name ?? 'Unknown',
          prefix: n.entrant.participants?.[0]?.prefix ?? null,
          seedNum: n.seedNum ?? n.entrant.initialSeedNum ?? null,
        } : null,
      }))

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

  const deeperOverrides = await resolveProjectionChain(intermediateDest, deeperOriginId, maxDepth - 1)
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
) {
  return useQuery({
    queryKey: ['crossPhaseOverrides', phaseId, originPhaseIds],
    queryFn: async (): Promise<CrossPhaseOverrides> => {
      // Fetch destination seeds for this phase
      const destSeedNodes = await fetchPhaseSeeds(phaseId)

      // Build seedIdToSeedNum map
      const seedIdToSeedNum = new Map<string, number>()
      const destinationSeeds: DestinationSeed[] = []

      for (const node of destSeedNodes) {
        if (node?.seedNum == null) continue
        if (node.id != null) {
          seedIdToSeedNum.set(String(node.id), node.seedNum)
        }
        destinationSeeds.push({
          seedNum: node.seedNum,
          progressionSeedId: node.progressionSeedId ?? null,
          placeholderName: node.placeholderName ?? null,
          entrant: node.entrant?.id ? {
            id: String(node.entrant.id),
            name: node.entrant.participants?.[0]?.gamerTag ?? node.entrant.name ?? 'Unknown',
            prefix: node.entrant.participants?.[0]?.prefix ?? null,
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
        const chainOverrides = await resolveProjectionChain(destinationSeeds, effectiveOriginIds[0])
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
      if (overrides.size < destinationSeeds.length && effectiveOriginIds.length > 0) {
        // Fetch all PGs for the origin phase to get progressionMap
        const originPhaseId = effectiveOriginIds[0]
        const originSeedNodes = await fetchPhaseSeeds(originPhaseId)

        // Get origin phase's PG IDs from seed nodes
        const originPgIds = new Set<string>()
        for (const node of originSeedNodes) {
          if (node?.phaseGroup?.id) originPgIds.add(node.phaseGroup.id)
        }

        for (const originPgId of originPgIds) {
          const pgResult = await fetchPhaseGroupSetData(
            originPgId,
            null,
            'ACTIVE', // Treat as active for fetching
            phaseName,
            phaseOrder,
          )

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
    staleTime: 5 * 60 * 1000,
  })
}
