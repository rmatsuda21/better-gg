import { graphql } from '../gql'
import type { PhaseBracketSetsActiveQuery, PhaseSetsByPhaseIdsSlimQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import type { PhaseGroupInfo } from './use-entrant-sets'
import type { SetProgressionInfo } from '../lib/bracket-utils'
import { computeBracketSizeFromSets } from '../lib/round-label-utils'
import { ACTIVITY_STATE, PAGINATION } from '../lib/constants'

// ACTIVE/COMPLETED: slot.entrant is always populated, no need for seed.entrant
const bracketSetsActiveQuery = graphql(`
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
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
          }
          loserProgressionSeed {
            seedNum
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
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
const bracketSetsCreatedQuery = graphql(`
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
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
          }
          loserProgressionSeed {
            seedNum
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
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
const bracketSetsCreatedWithByesQuery = graphql(`
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
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
          }
          loserProgressionSeed {
            seedNum
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
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

type ActiveSetNode = NonNullable<
  NonNullable<
    NonNullable<PhaseBracketSetsActiveQuery['phaseGroup']>['sets']
  >['nodes']
>[number]

export interface PhaseGroupSetResult {
  pgId: string
  displayIdentifier: string | null
  pgInfo: PhaseGroupInfo
  progressionMap: Map<string, SetProgressionInfo>
}

/** Shared query key so the route (useQueries) and cross-phase fallback dedupe via React Query cache. */
export const bracketSetsQueryKey = (pgId: string, phaseState: string | null) =>
  ['bracketSets', pgId, phaseState] as const

export const bracketByeSetsQueryKey = (pgId: string, phaseState: string | null) =>
  ['bracketByeSets', pgId, phaseState] as const

export const phaseSetsByPhaseIdsKey = (eventId: string, phaseId: string) =>
  ['phaseSetsByPhaseIds', eventId, phaseId] as const

// Slim variant fetched cross-phase: drops displayScore/fullRoundText/state/completedAt
// and uses event.sets(filters: { phaseIds }) so all PGs in the origin phase come back
// in a single paginated chain instead of N parallel per-PG queries.
const phaseSetsByPhaseIdsSlimQuery = graphql(`
  query PhaseSetsByPhaseIdsSlim($eventId: ID!, $phaseIds: [ID]!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      sets(page: $page, perPage: $perPage, sortType: ROUND, filters: { phaseIds: $phaseIds }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          round
          winnerId
          phaseGroup {
            id
            displayIdentifier
          }
          winnerProgressionSeed {
            seedNum
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
          }
          loserProgressionSeed {
            seedNum
            phase { id name groupCount }
            phaseGroup { id displayIdentifier }
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
                player { id }
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

type SlimSetNode = NonNullable<
  NonNullable<NonNullable<PhaseSetsByPhaseIdsSlimQuery['event']>['sets']>['nodes']
>[number]

/**
 * Fetch all sets for a phase in one paginated chain (across PGs) and group them by PG.
 * Builds the same `PhaseGroupSetResult` shape that `fetchPhaseGroupSetData` returns,
 * so callers can drop in without changes.
 *
 * Used by `useCrossPhaseOverrides` Strategy 2 to replace N parallel per-PG fetches
 * with a single phase-level fetch.
 */
export async function fetchOriginPhaseSetsByPg(
  eventId: string,
  phaseId: string,
  phaseName: string | null,
  phaseOrder: number | null,
): Promise<Map<string, PhaseGroupSetResult>> {
  const perPage = PAGINATION.ACTIVE_SETS

  const firstPage = await graphqlClient.request(phaseSetsByPhaseIdsSlimQuery, {
    eventId,
    phaseIds: [phaseId],
    page: 1,
    perPage,
  })

  const allNodes: Array<NonNullable<SlimSetNode>> = []
  for (const n of firstPage.event?.sets?.nodes ?? []) {
    if (n) allNodes.push(n)
  }
  const totalPages = firstPage.event?.sets?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(phaseSetsByPhaseIdsSlimQuery, {
          eventId,
          phaseIds: [phaseId],
          page: i + 2,
          perPage,
        }),
      ),
    )
    for (const r of remaining) {
      for (const n of r.event?.sets?.nodes ?? []) {
        if (n) allNodes.push(n)
      }
    }
  }

  // Group nodes by phaseGroup.id
  const byPg = new Map<string, { displayIdentifier: string | null; nodes: Array<NonNullable<SlimSetNode>> }>()
  for (const node of allNodes) {
    const pgId = node.phaseGroup?.id != null ? String(node.phaseGroup.id) : null
    if (!pgId) continue
    let bucket = byPg.get(pgId)
    if (!bucket) {
      bucket = { displayIdentifier: node.phaseGroup?.displayIdentifier ?? null, nodes: [] }
      byPg.set(pgId, bucket)
    }
    bucket.nodes.push(node)
  }

  // Build PhaseGroupSetResult per PG — same shape fetchPhaseGroupSetData returns
  const result = new Map<string, PhaseGroupSetResult>()
  for (const [pgId, { displayIdentifier, nodes }] of byPg) {
    const progressionMap = new Map<string, SetProgressionInfo>()
    for (const node of nodes) {
      if (!node.id) continue
      const wps = node.winnerProgressionSeed
      const lps = node.loserProgressionSeed
      if (wps?.phase || lps?.phase) {
        progressionMap.set(String(node.id), {
          winnerPhase: wps?.phase?.id ? { id: String(wps.phase.id), name: wps.phase.name ?? '', groupCount: wps.phase.groupCount ?? null } : null,
          loserPhase: lps?.phase?.id ? { id: String(lps.phase.id), name: lps.phase.name ?? '', groupCount: lps.phase.groupCount ?? null } : null,
          winnerSeedNum: wps?.seedNum ?? null,
          loserSeedNum: lps?.seedNum ?? null,
          winnerPhaseGroup: wps?.phaseGroup?.id ? { id: String(wps.phaseGroup.id), displayIdentifier: wps.phaseGroup.displayIdentifier ?? null } : null,
          loserPhaseGroup: lps?.phaseGroup?.id ? { id: String(lps.phaseGroup.id), displayIdentifier: lps.phaseGroup.displayIdentifier ?? null } : null,
        })
      }
    }

    const pgInfo: PhaseGroupInfo = {
      phaseGroupId: pgId,
      displayIdentifier,
      phaseName,
      phaseOrder,
      bracketType: null,
      userSeedNum: null,
      bracketSize: computeBracketSizeFromSets(nodes as PhaseGroupInfo['allSets']),
      sets: nodes as PhaseGroupInfo['sets'],
      allSets: nodes as PhaseGroupInfo['allSets'],
    }

    result.set(pgId, { pgId, displayIdentifier, pgInfo, progressionMap })
  }

  return result
}

export async function fetchPhaseGroupSets(
  pgId: string,
  query: typeof bracketSetsActiveQuery | typeof bracketSetsCreatedQuery,
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

export async function fetchPhaseGroupSetsWithByes(pgId: string, perPage: number) {
  const firstPage = await graphqlClient.request(bracketSetsCreatedWithByesQuery, {
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
        graphqlClient.request(bracketSetsCreatedWithByesQuery, {
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

export async function fetchPhaseGroupSetData(
  pgId: string,
  displayIdentifier: string | null,
  phaseState: string | null,
  phaseName: string | null,
  phaseOrder: number | null,
): Promise<PhaseGroupSetResult> {
  const isStarted = phaseState === ACTIVITY_STATE.ACTIVE || phaseState === ACTIVITY_STATE.COMPLETED
  const query = isStarted ? bracketSetsActiveQuery : bracketSetsCreatedQuery
  const perPage = isStarted ? PAGINATION.ACTIVE_SETS : PAGINATION.CREATED_SETS

  const nodes = await fetchPhaseGroupSets(pgId, query, perPage)

  const allPgSets: Array<NonNullable<ActiveSetNode>> = []
  const progressionMap = new Map<string, SetProgressionInfo>()

  for (const node of nodes) {
    if (!node?.id) continue

    // Extract progression info (available in both ACTIVE and CREATED queries)
    if ('winnerProgressionSeed' in node) {
      const activeNode = node as NonNullable<ActiveSetNode>
      const wps = activeNode.winnerProgressionSeed
      const lps = activeNode.loserProgressionSeed
      if (wps?.phase || lps?.phase) {
        progressionMap.set(String(node.id), {
          winnerPhase: wps?.phase?.id ? { id: String(wps.phase.id), name: wps.phase.name ?? '', groupCount: wps.phase.groupCount ?? null } : null,
          loserPhase: lps?.phase?.id ? { id: String(lps.phase.id), name: lps.phase.name ?? '', groupCount: lps.phase.groupCount ?? null } : null,
          winnerSeedNum: wps?.seedNum ?? null,
          loserSeedNum: lps?.seedNum ?? null,
          winnerPhaseGroup: wps?.phaseGroup?.id ? { id: String(wps.phaseGroup.id), displayIdentifier: wps.phaseGroup.displayIdentifier ?? null } : null,
          loserPhaseGroup: lps?.phaseGroup?.id ? { id: String(lps.phaseGroup.id), displayIdentifier: lps.phaseGroup.displayIdentifier ?? null } : null,
        })
      }
    }

    allPgSets.push(node as unknown as PhaseGroupInfo['allSets'][number])
  }

  const pgInfo: PhaseGroupInfo = {
    phaseGroupId: pgId,
    displayIdentifier,
    phaseName,
    phaseOrder,
    bracketType: null,
    userSeedNum: null,
    bracketSize: computeBracketSizeFromSets(allPgSets),
    sets: allPgSets,
    allSets: allPgSets,
  }

  return { pgId, displayIdentifier, pgInfo, progressionMap }
}
