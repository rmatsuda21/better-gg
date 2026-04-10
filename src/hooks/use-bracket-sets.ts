import { graphql } from '../gql'
import type { PhaseBracketSetsActiveQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import type { PhaseGroupInfo } from './use-entrant-sets'
import type { SetProgressionInfo } from '../lib/bracket-utils'
import { computeBracketSizeFromSets } from '../lib/round-label-utils'

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
  const isStarted = phaseState === 'ACTIVE' || phaseState === 'COMPLETED'
  const query = isStarted ? bracketSetsActiveQuery : bracketSetsCreatedQuery
  const perPage = isStarted ? 50 : 35

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
          winnerPhase: wps?.phase?.id ? { id: String(wps.phase.id), name: wps.phase.name ?? '' } : null,
          loserPhase: lps?.phase?.id ? { id: String(lps.phase.id), name: lps.phase.name ?? '' } : null,
          winnerSeedNum: wps?.seedNum ?? null,
          loserSeedNum: lps?.seedNum ?? null,
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
