import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { PhaseBracketSetsActiveQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { mapSeedsByPlaceholder, mapSeedsByProgressionId } from '../lib/projection-utils'
import type { PhaseGroupInfo } from './use-entrant-sets'

const phaseBracketMetaQuery = graphql(`
  query PhaseBracketMeta($phaseId: ID!) {
    phase(id: $phaseId) {
      id
      name
      phaseOrder
      bracketType
      state
      event {
        id
        state
        phases {
          id
          name
          phaseOrder
        }
      }
      phaseGroups {
        nodes {
          id
          displayIdentifier
        }
      }
      progressingInData {
        origin
        numProgressing
      }
      seeds(query: { page: 1, perPage: 5 }) {
        nodes {
          progressionSource {
            originPhase { id name }
          }
        }
      }
    }
  }
`)

// ACTIVE/COMPLETED: slot.entrant is always populated, no need for seed.entrant
// ~15 objects per set (with progression seeds) → perPage: 50 stays under 1000 object limit
const phaseBracketSetsActiveQuery = graphql(`
  query PhaseBracketSetsActive($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
    phaseGroup(id: $phaseGroupId) {
      id
      sets(page: $page, perPage: $perPage, sortType: ROUND) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          state
          round
          fullRoundText
          displayScore
          winnerId
          completedAt
          winnerProgressionSeed {
            seedNum
            phase { id name }
          }
          loserProgressionSeed {
            seedNum
            phase { id name }
          }
          slots {
            id
            prereqType
            prereqId
            prereqPlacement
            entrant {
              id
              name
              initialSeedNum
              participants {
                id
                gamerTag
                prefix
                player {
                  id
                }
              }
            }
            seed {
              id
              seedNum
            }
          }
        }
      }
    }
  }
`)

// CREATED: slot.entrant may be null, need seed.entrant as fallback
// Many null slots keep effective object count low; perPage: 50 is safe
// Progression seeds are available even on CREATED sets for cross-phase routing
const phaseBracketSetsCreatedQuery = graphql(`
  query PhaseBracketSetsCreated($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
    phaseGroup(id: $phaseGroupId) {
      id
      sets(page: $page, perPage: $perPage, sortType: ROUND) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          state
          round
          fullRoundText
          displayScore
          winnerId
          completedAt
          winnerProgressionSeed {
            seedNum
            phase { id name }
          }
          loserProgressionSeed {
            seedNum
            phase { id name }
          }
          slots {
            id
            prereqType
            prereqId
            prereqPlacement
            entrant {
              id
              name
              initialSeedNum
              participants {
                id
                gamerTag
                prefix
                player {
                  id
                }
              }
            }
            seed {
              id
              seedNum
              entrant {
                id
                name
                initialSeedNum
                participants {
                  id
                  gamerTag
                  prefix
                  player {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`)

// CREATED with showByes: includes hidden bye rounds for complete projection chain
// Same fields as phaseBracketSetsCreatedQuery, but accepts a filters variable
const phaseBracketSetsCreatedWithByesQuery = graphql(`
  query PhaseBracketSetsCreatedWithByes($phaseGroupId: ID!, $page: Int!, $perPage: Int!, $filters: SetFilters) {
    phaseGroup(id: $phaseGroupId) {
      id
      sets(page: $page, perPage: $perPage, sortType: ROUND, filters: $filters) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          state
          round
          fullRoundText
          displayScore
          winnerId
          completedAt
          winnerProgressionSeed {
            seedNum
            phase { id name }
          }
          loserProgressionSeed {
            seedNum
            phase { id name }
          }
          slots {
            id
            prereqType
            prereqId
            prereqPlacement
            entrant {
              id
              name
              initialSeedNum
              participants {
                id
                gamerTag
                prefix
                player {
                  id
                }
              }
            }
            seed {
              id
              seedNum
              entrant {
                id
                name
                initialSeedNum
                participants {
                  id
                  gamerTag
                  prefix
                  player {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`)

// Fetch phase seeds with progression data for cross-phase projection
// ~7 objects per seed (entrant + participants + phaseGroup + progressionSource) → perPage: 80
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

type ActiveSetNode = NonNullable<
  NonNullable<
    NonNullable<PhaseBracketSetsActiveQuery['phaseGroup']>['sets']
  >['nodes']
>[number]

export interface SiblingPhaseInfo {
  id: string
  name: string
  phaseOrder: number
}

export interface SetProgressionInfo {
  winnerPhase: { id: string; name: string } | null
  loserPhase: { id: string; name: string } | null
  loserSeedNum: number | null
  winnerSeedNum: number | null
}

export interface OriginSeedEntrant {
  id: string
  name: string
  seedNum: number | null
}

export interface DestinationSeed {
  seedNum: number
  progressionSeedId: number | null
  placeholderName: string | null
  entrant: OriginSeedEntrant | null
}

export interface PhaseBracketResult {
  phaseName: string | null
  bracketType: string | null
  phaseState: string | null
  eventState: string | null
  eventId: string | null
  currentPhaseOrder: number | null
  siblingPhases: SiblingPhaseInfo[]
  phaseGroups: PhaseGroupInfo[]
  projectionPhaseGroups: PhaseGroupInfo[]
  progressionMap: Map<string, SetProgressionInfo>
  originPhaseIds: string[]
  destinationSeeds: DestinationSeed[]
  projectedOverrides: Map<number, OriginSeedEntrant> | null
  seedIdToSeedNum: Map<string, number>
}

async function fetchPhaseGroupSets(
  pgId: string,
  query: typeof phaseBracketSetsActiveQuery | typeof phaseBracketSetsCreatedQuery,
  perPage: number,
) {
  const firstPage = await graphqlClient.request(query, {
    phaseGroupId: pgId,
    page: 1,
    perPage,
  })

  const allNodes = [...(firstPage.phaseGroup?.sets?.nodes ?? [])]
  const totalPages = firstPage.phaseGroup?.sets?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(query, {
          phaseGroupId: pgId,
          page: i + 2,
          perPage,
        })
      )
    )
    for (const r of remaining) {
      allNodes.push(...(r.phaseGroup?.sets?.nodes ?? []))
    }
  }

  return allNodes
}

async function fetchPhaseGroupSetsWithByes(pgId: string, perPage: number) {
  const firstPage = await graphqlClient.request(phaseBracketSetsCreatedWithByesQuery, {
    phaseGroupId: pgId,
    page: 1,
    perPage,
    filters: { showByes: true },
  })

  const allNodes = [...(firstPage.phaseGroup?.sets?.nodes ?? [])]
  const totalPages = firstPage.phaseGroup?.sets?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(phaseBracketSetsCreatedWithByesQuery, {
          phaseGroupId: pgId,
          page: i + 2,
          perPage,
          filters: { showByes: true },
        })
      )
    )
    for (const r of remaining) {
      allNodes.push(...(r.phaseGroup?.sets?.nodes ?? []))
    }
  }

  return allNodes
}

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

type SeedNode = NonNullable<Awaited<ReturnType<typeof fetchPhaseSeeds>>[number]>

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
    // Origin phase has entrants — map them to destination seeds
    const originSeedsRaw = originSeedNodes
      .filter((n): n is NonNullable<typeof n> => n?.id != null && n?.seedNum != null)
      .map(n => ({
        id: n.id!,
        seedNum: n.seedNum!,
        progressionSeedId: n.progressionSeedId ?? null,
        groupDisplayId: n.phaseGroup?.displayIdentifier ?? null,
        entrant: n.entrant?.id ? {
          id: String(n.entrant.id),
          name: n.entrant.name ?? 'Unknown',
          seedNum: n.seedNum ?? n.entrant.initialSeedNum ?? null,
        } : null,
      }))

    // Primary: direct mapping via progressionSeedId
    const directMap = mapSeedsByProgressionId(destSeeds, originSeedsRaw)
    if (directMap.size > 0) return directMap

    // Fallback: placeholder-based mapping
    return mapSeedsByPlaceholder(destSeeds, originSeedsRaw)
  }

  // Origin phase ALSO has no entrants — recurse deeper
  const deeperOriginId = findOriginPhaseId(originSeedNodes)
  if (!deeperOriginId) return null

  // Build intermediate destination seeds from the origin seed nodes
  const intermediateDest: DestinationSeed[] = originSeedNodes
    .filter((n): n is NonNullable<typeof n> => n?.seedNum != null)
    .map(n => ({
      seedNum: n.seedNum!,
      progressionSeedId: n.progressionSeedId ?? null,
      placeholderName: n.placeholderName ?? null,
      entrant: null,
    }))

  // Recursively resolve the deeper origin
  const deeperOverrides = await resolveProjectionChain(intermediateDest, deeperOriginId, maxDepth - 1)
  if (!deeperOverrides || deeperOverrides.size === 0) return null

  // Now the origin seeds have "virtual" entrants from the deeper resolution.
  // Rebuild origin seeds with the resolved entrants and map to our destination.
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

  // Primary: direct mapping via progressionSeedId
  const directMap = mapSeedsByProgressionId(destSeeds, resolvedOriginSeeds)
  if (directMap.size > 0) return directMap

  // Fallback: placeholder-based mapping
  return mapSeedsByPlaceholder(destSeeds, resolvedOriginSeeds)
}

/** Extract the origin phase ID from seed nodes' progressionSource */
function findOriginPhaseId(seedNodes: Array<SeedNode | null>): string | null {
  for (const node of seedNodes) {
    const originId = node?.progressionSource?.originPhase?.id
    if (originId != null) return String(originId)
  }
  return null
}

export function usePhaseBracket(phaseId: string) {
  return useQuery({
    queryKey: ['phaseBracket', phaseId],
    queryFn: async (): Promise<PhaseBracketResult> => {
      // Step 1: fetch phase metadata + phase group IDs
      const meta = await graphqlClient.request(phaseBracketMetaQuery, { phaseId })
      const phase = meta.phase
      if (!phase) throw new Error('Phase not found')

      const pgNodes = phase.phaseGroups?.nodes ?? []
      const isStarted = phase.state === 'ACTIVE' || phase.state === 'COMPLETED'
      const query = isStarted ? phaseBracketSetsActiveQuery : phaseBracketSetsCreatedQuery
      const perPage = isStarted ? 50 : 35

      // Extract origin phase IDs early (needed for parallel seed fetch)
      const originPhaseIds: string[] = (phase.progressingInData ?? [])
        .filter((d): d is NonNullable<typeof d> => d != null && d.origin != null)
        .map(d => String(d.origin!))

      // Fallback: use seeds' progressionSource when progressingInData is empty
      if (originPhaseIds.length === 0) {
        const seedOrigin = (phase.seeds?.nodes ?? [])
          .find(s => s?.progressionSource?.originPhase?.id != null)
          ?.progressionSource?.originPhase
        if (seedOrigin) {
          originPhaseIds.push(String(seedOrigin.id))
        }
      }

      // Step 2: fetch sets per phase group + destination seeds in parallel
      // For CREATED phases, also fetch with showByes for projection
      const setsPromise = Promise.all(
        pgNodes.map(async (pg) => {
          if (!pg?.id) return null
          const [displayNodes, projectionNodes] = await Promise.all([
            fetchPhaseGroupSets(pg.id, query, perPage),
            !isStarted ? fetchPhaseGroupSetsWithByes(pg.id, perPage) : null,
          ])
          return {
            pgId: pg.id,
            displayIdentifier: pg.displayIdentifier,
            nodes: displayNodes,
            projectionNodes: projectionNodes ?? displayNodes,
          }
        })
      )

      // Fetch destination seeds when origins exist or phase hasn't started (CREATED phases
      // may have progressionSeedId on seeds even when originPhaseIds couldn't be discovered yet)
      const shouldFetchDestSeeds = !isStarted || originPhaseIds.length > 0
      const seedsPromise = shouldFetchDestSeeds
        ? fetchPhaseSeeds(phaseId)
        : null

      const [pgResults, destSeedNodes] = await Promise.all([setsPromise, seedsPromise])

      // Fallback: extract origin phase IDs from destination seeds' progressionSource
      if (originPhaseIds.length === 0 && destSeedNodes) {
        for (const node of destSeedNodes) {
          const originId = node?.progressionSource?.originPhase?.id
          if (originId != null) {
            originPhaseIds.push(String(originId))
            break
          }
        }
      }

      // Step 3: build PhaseGroupInfo[] + projectionPhaseGroups[] + progressionMap from results
      const phaseGroups: PhaseGroupInfo[] = []
      const projectionPhaseGroups: PhaseGroupInfo[] = []
      const progressionMap = new Map<string, SetProgressionInfo>()

      for (const result of pgResults) {
        if (!result) continue

        const allPgSets: Array<NonNullable<ActiveSetNode>> = []
        for (const node of result.nodes) {
          if (!node?.id) continue

          // Extract progression info before casting (available in both ACTIVE and CREATED queries)
          if ('winnerProgressionSeed' in node) {
            const activeNode = node as NonNullable<ActiveSetNode>
            const wps = activeNode.winnerProgressionSeed
            const lps = activeNode.loserProgressionSeed
            if (wps?.phase || lps?.phase) {
              progressionMap.set(String(node.id), {
                winnerPhase: wps?.phase?.id ? { id: String(wps.phase.id), name: wps.phase.name ?? '' } : null,
                loserPhase: lps?.phase?.id ? { id: String(lps.phase.id), name: lps.phase.name ?? '' } : null,
                winnerSeedNum: wps?.seedNum ?? null,
                loserSeedNum: lps?.seedNum ?? null,
              })
            }
          }

          const castNode = node as unknown as PhaseGroupInfo['allSets'][number]
          allPgSets.push(castNode)
        }

        // Build projection sets from bye-inclusive data
        const allProjectionSets: Array<NonNullable<ActiveSetNode>> = []
        for (const node of result.projectionNodes) {
          if (!node?.id) continue
          allProjectionSets.push(node as unknown as PhaseGroupInfo['allSets'][number])
        }

        if (allPgSets.length > 0) {
          const pgInfo: PhaseGroupInfo = {
            phaseGroupId: result.pgId,
            displayIdentifier: result.displayIdentifier ?? null,
            phaseName: phase.name ?? null,
            phaseOrder: phase.phaseOrder ?? null,
            userSeedNum: null,
            sets: allPgSets,
            allSets: allPgSets,
          }
          phaseGroups.push(pgInfo)

          // Projection phase group uses bye-inclusive sets (or same sets for ACTIVE/COMPLETED)
          if (allProjectionSets.length > 0 && allProjectionSets !== allPgSets) {
            projectionPhaseGroups.push({
              ...pgInfo,
              sets: allProjectionSets,
              allSets: allProjectionSets,
            })
          } else {
            projectionPhaseGroups.push(pgInfo)
          }
        }
      }

      // Step 4: build destination seeds + seed ID → seedNum map from seed results
      const destinationSeeds: DestinationSeed[] = []
      const seedIdToSeedNum = new Map<string, number>()

      if (destSeedNodes) {
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
              name: node.entrant.name ?? 'Unknown',
              seedNum: node.seedNum,
            } : null,
          })
        }
      }

      // Step 5: resolve projected overrides for empty phases via chain resolution
      const phaseHasEntrants = phaseGroups.some(pg =>
        pg.allSets.some(set =>
          set.slots?.some(slot => {
            const ent = slot?.entrant ?? slot?.seed?.entrant
            return ent?.id != null
          })
        )
      )

      let projectedOverrides: Map<number, OriginSeedEntrant> | null = null
      if (!phaseHasEntrants && originPhaseIds.length > 0 && destinationSeeds.length > 0) {
        projectedOverrides = await resolveProjectionChain(destinationSeeds, originPhaseIds[0])
      }

      const siblingPhases: SiblingPhaseInfo[] = (phase.event?.phases ?? [])
        .filter((p): p is NonNullable<typeof p> => p != null && p.id != null && p.name != null && p.phaseOrder != null)
        .map(p => ({ id: String(p.id!), name: p.name!, phaseOrder: p.phaseOrder! }))

      return {
        phaseName: phase.name ?? null,
        bracketType: phase.bracketType ?? null,
        phaseState: phase.state ?? null,
        eventState: phase.event?.state ?? null,
        eventId: phase.event?.id ? String(phase.event.id) : null,
        currentPhaseOrder: phase.phaseOrder ?? null,
        siblingPhases,
        phaseGroups,
        projectionPhaseGroups,
        progressionMap,
        originPhaseIds,
        destinationSeeds,
        projectedOverrides,
        seedIdToSeedNum,
      }
    },
    enabled: !!phaseId,
    staleTime: 5 * 60 * 1000,
  })
}
