import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { PhaseBracketSetsActiveQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
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
      }
      phaseGroups {
        nodes {
          id
          displayIdentifier
        }
      }
    }
  }
`)

// ACTIVE/COMPLETED: slot.entrant is always populated, no need for seed.entrant
// ~11 objects per set → perPage: 50 stays under 1000 object limit
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

export interface PhaseBracketResult {
  phaseName: string | null
  bracketType: string | null
  phaseState: string | null
  eventState: string | null
  phaseGroups: PhaseGroupInfo[]
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

export function usePhaseBracket(phaseId: string) {
  return useQuery({
    queryKey: ['phaseBracket', phaseId],
    queryFn: async (): Promise<PhaseBracketResult> => {
      // Step 1: fetch phase metadata + phase group IDs
      const meta = await graphqlClient.request(phaseBracketMetaQuery, { phaseId })
      const phase = meta.phase
      if (!phase) throw new Error('Phase not found')

      const pgNodes = phase.phaseGroups?.nodes ?? []
      const isStarted = phase.event?.state === 'ACTIVE' || phase.event?.state === 'COMPLETED'
      const query = isStarted ? phaseBracketSetsActiveQuery : phaseBracketSetsCreatedQuery
      const perPage = 50

      // Step 2: fetch sets per phase group in parallel
      const pgResults = await Promise.all(
        pgNodes.map(async (pg) => {
          if (!pg?.id) return null
          const nodes = await fetchPhaseGroupSets(pg.id, query, perPage)
          return { pgId: pg.id, displayIdentifier: pg.displayIdentifier, nodes }
        })
      )

      // Step 3: build PhaseGroupInfo[] from results
      const phaseGroups: PhaseGroupInfo[] = []

      for (const result of pgResults) {
        if (!result) continue

        const allPgSets: Array<NonNullable<ActiveSetNode>> = []
        for (const node of result.nodes) {
          if (!node?.id) continue
          const castNode = node as unknown as PhaseGroupInfo['allSets'][number]
          allPgSets.push(castNode)
        }

        if (allPgSets.length > 0) {
          phaseGroups.push({
            phaseGroupId: result.pgId,
            displayIdentifier: result.displayIdentifier ?? null,
            phaseName: phase.name ?? null,
            phaseOrder: phase.phaseOrder ?? null,
            userSeedNum: null,
            sets: allPgSets,
            allSets: allPgSets,
          })
        }
      }

      return {
        phaseName: phase.name ?? null,
        bracketType: phase.bracketType ?? null,
        phaseState: phase.state ?? null,
        eventState: phase.event?.state ?? null,
        phaseGroups,
      }
    },
    enabled: !!phaseId,
    staleTime: 5 * 60 * 1000,
  })
}
