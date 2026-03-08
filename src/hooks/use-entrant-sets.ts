import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { EntrantSetsQuery, EntrantPhaseGroupSetsQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'

const entrantSetsQuery = graphql(`
  query EntrantSets($entrantId: ID!, $page: Int!, $perPage: Int!, $sortType: SetSortType) {
    entrant(id: $entrantId) {
      id
      name
      initialSeedNum
      paginatedSets(page: $page, perPage: $perPage, sortType: $sortType) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          state
          round
          fullRoundText
          displayScore(mainEntrantId: $entrantId)
          winnerId
          completedAt
          slots {
            id
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
          games {
            id
            orderNum
            winnerId
            selections {
              id
              entrant {
                id
              }
              selectionType
              selectionValue
            }
          }
        }
      }
    }
  }
`)

const entrantPhaseGroupSetsQuery = graphql(`
  query EntrantPhaseGroupSets($entrantId: ID!, $perPage: Int!) {
    entrant(id: $entrantId) {
      id
      name
      initialSeedNum
      seeds {
        id
        seedNum
        phaseGroup {
          id
          displayIdentifier
          phase {
            id
            name
            phaseOrder
          }
          sets(page: 1, perPage: $perPage, sortType: ROUND) {
            nodes {
              id
              state
              round
              fullRoundText
              displayScore(mainEntrantId: $entrantId)
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
    }
  }
`)

type SeedNode = NonNullable<
  NonNullable<EntrantPhaseGroupSetsQuery['entrant']>['seeds']
>[number]
type PhaseGroupSetNode = NonNullable<
  NonNullable<
    NonNullable<NonNullable<SeedNode>['phaseGroup']>['sets']
  >['nodes']
>[number]

export interface PhaseGroupInfo {
  phaseGroupId: string
  displayIdentifier: string | null
  phaseName: string | null
  phaseOrder: number | null
  userSeedNum: number | null
  sets: Array<NonNullable<PhaseGroupSetNode>>
  allSets: Array<NonNullable<PhaseGroupSetNode>>
}

export function useEntrantSets(entrantId: string | undefined, eventState?: string | null) {
  const isStarted = eventState === 'ACTIVE' || eventState === 'COMPLETED'

  return useQuery({
    queryKey: ['entrantSets', entrantId, isStarted ? 'started' : 'projected'],
    queryFn: async (): Promise<EntrantSetsQuery & { phaseGroups?: PhaseGroupInfo[] }> => {
      if (isStarted) {
        return graphqlClient.request(entrantSetsQuery, {
          entrantId: entrantId!,
          page: 1,
          perPage: 50,
          sortType: 'ROUND',
        })
      }

      const result = await graphqlClient.request(entrantPhaseGroupSetsQuery, {
        entrantId: entrantId!,
        perPage: 128,
      })

      // Resolve entrant from either slot.entrant or slot.seed.entrant (fallback for CREATED events)
      const resolveEntrant = (slot: { entrant?: { id?: string | null } | null; seed?: { entrant?: { id?: string | null } | null } | null } | null) =>
        slot?.entrant ?? slot?.seed?.entrant

      // Build phase groups and flatten sets with deduplication
      const seenIds = new Set<string>()
      const allSets: Array<NonNullable<PhaseGroupSetNode>> = []
      const phaseGroups: PhaseGroupInfo[] = []

      for (const seed of result.entrant?.seeds ?? []) {
        const pg = seed?.phaseGroup
        if (!pg?.id) continue

        // Collect all valid sets in this phase group (unfiltered)
        const allPgSets: Array<NonNullable<PhaseGroupSetNode>> = []
        const pgSets: Array<NonNullable<PhaseGroupSetNode>> = []
        for (const node of pg.sets?.nodes ?? []) {
          if (!node?.id || seenIds.has(node.id)) continue
          seenIds.add(node.id)
          allPgSets.push(node)
          // Client-side filter: only keep sets involving our entrant
          const involvesUser = node.slots?.some(s => resolveEntrant(s)?.id === entrantId)
          if (involvesUser) {
            allSets.push(node)
            pgSets.push(node)
          }
        }

        if (pgSets.length > 0) {
          phaseGroups.push({
            phaseGroupId: pg.id,
            displayIdentifier: pg.displayIdentifier ?? null,
            phaseName: pg.phase?.name ?? null,
            phaseOrder: pg.phase?.phaseOrder ?? null,
            userSeedNum: seed?.seedNum ?? null,
            sets: pgSets,
            allSets: allPgSets,
          })
        }
      }

      phaseGroups.sort((a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0))

      // Reshape to match the primary query's return structure
      return {
        entrant: {
          id: result.entrant?.id,
          name: result.entrant?.name,
          initialSeedNum: result.entrant?.initialSeedNum,
          paginatedSets: {
            pageInfo: { total: allSets.length, totalPages: 1 },
            nodes: allSets,
          },
        },
        phaseGroups,
      } as unknown as EntrantSetsQuery & { phaseGroups: PhaseGroupInfo[] }
    },
    enabled: !!entrantId,
    staleTime: 5 * 60 * 1000,
  })
}
