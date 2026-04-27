import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { PhaseGroupSetsCreatedQuery } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { computeBracketSizeFromSets } from '../lib/round-label-utils'
import { ACTIVITY_STATE, PAGINATION, STALE_TIME_MS } from '../lib/constants'

// Per-phase-group sets for CREATED events (step 2)
// Includes seed.entrant (slot.entrant may be null for unseeded brackets)
const phaseGroupSetsCreatedQuery = graphql(`
  query PhaseGroupSetsCreated($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
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

// Lightweight seed/phase group metadata for ACTIVE/COMPLETED events (step 1)
const entrantSeedsQuery = graphql(`
  query EntrantSeeds($entrantId: ID!) {
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
            bracketType
          }
        }
      }
    }
  }
`)

// Per-phase-group sets for ACTIVE/COMPLETED events (step 2)
// Omits seed.entrant (redundant — slot.entrant is always populated for started events)
const phaseGroupSetsQuery = graphql(`
  query PhaseGroupSets($phaseGroupId: ID!, $page: Int!, $perPage: Int!) {
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

type PhaseGroupSetNode = NonNullable<
  NonNullable<
    NonNullable<PhaseGroupSetsCreatedQuery['phaseGroup']>['sets']
  >['nodes']
>[number]

export interface PhaseGroupInfo {
  phaseGroupId: string
  displayIdentifier: string | null
  phaseName: string | null
  phaseOrder: number | null
  bracketType: string | null
  userSeedNum: number | null
  bracketSize: number
  sets: Array<NonNullable<PhaseGroupSetNode>>
  allSets: Array<NonNullable<PhaseGroupSetNode>>
}

interface EntrantSetsResult {
  entrant?: {
    id?: string | null
    name?: string | null
    initialSeedNum?: number | null
    paginatedSets?: {
      pageInfo: { total: number; totalPages: number }
      nodes: Array<NonNullable<PhaseGroupSetNode>>
    }
  } | null
  phaseGroups?: PhaseGroupInfo[]
}

export function useEntrantSets(entrantId: string | undefined, eventState?: string | null) {
  return useQuery({
    queryKey: ['entrantSets', entrantId, eventState ?? 'unknown'],
    queryFn: async (): Promise<EntrantSetsResult> => {
      // Resolve entrant from either slot.entrant or slot.seed.entrant (fallback for CREATED events)
      const resolveEntrant = (slot: { entrant?: { id?: string | null } | null; seed?: { entrant?: { id?: string | null } | null } | null } | null) =>
        slot?.entrant ?? slot?.seed?.entrant

      const isStarted = eventState === ACTIVITY_STATE.ACTIVE || eventState === ACTIVITY_STATE.COMPLETED

      if (isStarted) {
        // ACTIVE/COMPLETED: two-step fetch to stay under 1000 objects per request
        // Step 1: lightweight seed/phase group metadata
        const seedsResult = await graphqlClient.request(entrantSeedsQuery, {
          entrantId: entrantId!,
        })

        const seeds = seedsResult.entrant?.seeds ?? []
        const seenPgIds = new Set<string>()
        const uniqueSeeds = seeds.filter(s => {
          if (!s?.phaseGroup?.id || seenPgIds.has(s.phaseGroup.id)) return false
          seenPgIds.add(s.phaseGroup.id)
          return true
        })

        // Step 2: fetch sets per phase group in parallel
        const pgResults = await Promise.all(
          uniqueSeeds.map(async (seed) => {
            const pgId = seed!.phaseGroup!.id!
            const pg = seed!.phaseGroup!

            // Fetch page 1
            const firstPage = await graphqlClient.request(phaseGroupSetsQuery, {
              phaseGroupId: pgId, page: 1, perPage: PAGINATION.ENTRANT_SETS_SIMPLE,
            })
            const allNodes = [...(firstPage.phaseGroup?.sets?.nodes ?? [])]

            // Paginate if needed
            const totalPages = firstPage.phaseGroup?.sets?.pageInfo?.totalPages ?? 1
            if (totalPages > 1) {
              const remaining = await Promise.all(
                Array.from({ length: totalPages - 1 }, (_, i) =>
                  graphqlClient.request(phaseGroupSetsQuery, {
                    phaseGroupId: pgId, page: i + 2, perPage: PAGINATION.ENTRANT_SETS_SIMPLE,
                  })
                )
              )
              for (const r of remaining) {
                allNodes.push(...(r.phaseGroup?.sets?.nodes ?? []))
              }
            }

            return { seed: seed!, pg, nodes: allNodes }
          })
        )

        // Step 3: build PhaseGroupInfo[] from results
        const seenIds = new Set<string>()
        const allSets: Array<NonNullable<PhaseGroupSetNode>> = []
        const phaseGroups: PhaseGroupInfo[] = []

        for (const { seed, pg, nodes } of pgResults) {
          const allPgSets: Array<NonNullable<PhaseGroupSetNode>> = []
          const pgSets: Array<NonNullable<PhaseGroupSetNode>> = []

          for (const node of nodes) {
            if (!node?.id || seenIds.has(node.id)) continue
            seenIds.add(node.id)
            // Cast: per-PG query omits seed.entrant but shape is compatible
            // (seed.entrant is nullable in the full type, consumers use optional chaining)
            const castNode = node as unknown as NonNullable<PhaseGroupSetNode>
            allPgSets.push(castNode)
            const involvesUser = castNode.slots?.some(s => String(resolveEntrant(s)?.id) === entrantId)
            if (involvesUser) {
              allSets.push(castNode)
              pgSets.push(castNode)
            }
          }

          if (pgSets.length > 0) {
            phaseGroups.push({
              phaseGroupId: String(pg.id!),
              displayIdentifier: pg.displayIdentifier ?? null,
              phaseName: pg.phase?.name ?? null,
              phaseOrder: pg.phase?.phaseOrder ?? null,
              bracketType: pg.phase?.bracketType ?? null,
              userSeedNum: seed.seedNum ?? null,
              bracketSize: computeBracketSizeFromSets(allPgSets),
              sets: pgSets,
              allSets: allPgSets,
            })
          }
        }

        phaseGroups.sort((a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0))
        allSets.sort((a, b) => (a.completedAt ?? Infinity) - (b.completedAt ?? Infinity))

        return {
          entrant: {
            id: seedsResult.entrant?.id,
            name: seedsResult.entrant?.name,
            initialSeedNum: seedsResult.entrant?.initialSeedNum,
            paginatedSets: {
              pageInfo: { total: allSets.length, totalPages: 1 },
              nodes: allSets,
            },
          },
          phaseGroups,
        } satisfies EntrantSetsResult
      }

      // CREATED: two-step fetch (same pattern as ACTIVE) but with seed.entrant included
      // Step 1: lightweight seed/phase group metadata
      const seedsResult = await graphqlClient.request(entrantSeedsQuery, {
        entrantId: entrantId!,
      })

      const seeds = seedsResult.entrant?.seeds ?? []
      const seenPgIds2 = new Set<string>()
      const uniqueSeeds2 = seeds.filter(s => {
        if (!s?.phaseGroup?.id || seenPgIds2.has(s.phaseGroup.id)) return false
        seenPgIds2.add(s.phaseGroup.id)
        return true
      })

      // Step 2: fetch sets per phase group in parallel (with seed.entrant, perPage: 50)
      const pgResults2 = await Promise.all(
        uniqueSeeds2.map(async (seed) => {
          const pgId = seed!.phaseGroup!.id!
          const pg = seed!.phaseGroup!

          // Fetch page 1
          const firstPage = await graphqlClient.request(phaseGroupSetsCreatedQuery, {
            phaseGroupId: pgId, page: 1, perPage: PAGINATION.ENTRANT_SETS_EXTENDED,
          })
          const allNodes = [...(firstPage.phaseGroup?.sets?.nodes ?? [])]

          // Paginate if needed
          const totalPages = firstPage.phaseGroup?.sets?.pageInfo?.totalPages ?? 1
          if (totalPages > 1) {
            const remaining = await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, i) =>
                graphqlClient.request(phaseGroupSetsCreatedQuery, {
                  phaseGroupId: pgId, page: i + 2, perPage: PAGINATION.ENTRANT_SETS_EXTENDED,
                })
              )
            )
            for (const r of remaining) {
              allNodes.push(...(r.phaseGroup?.sets?.nodes ?? []))
            }
          }

          return { seed: seed!, pg, nodes: allNodes }
        })
      )

      // Step 3: build PhaseGroupInfo[] from results
      const seenIds = new Set<string>()
      const allSets: Array<NonNullable<PhaseGroupSetNode>> = []
      const phaseGroups: PhaseGroupInfo[] = []

      for (const { seed, pg, nodes } of pgResults2) {
        const allPgSets: Array<NonNullable<PhaseGroupSetNode>> = []
        const pgSets: Array<NonNullable<PhaseGroupSetNode>> = []

        for (const node of nodes) {
          if (!node?.id || seenIds.has(node.id)) continue
          seenIds.add(node.id)
          allPgSets.push(node)
          const involvesUser = node.slots?.some(s => String(resolveEntrant(s)?.id) === entrantId)
          if (involvesUser) {
            allSets.push(node)
            pgSets.push(node)
          }
        }

        if (pgSets.length > 0) {
          phaseGroups.push({
            phaseGroupId: String(pg.id!),
            displayIdentifier: pg.displayIdentifier ?? null,
            phaseName: pg.phase?.name ?? null,
            phaseOrder: pg.phase?.phaseOrder ?? null,
            bracketType: pg.phase?.bracketType ?? null,
            userSeedNum: seed.seedNum ?? null,
            bracketSize: computeBracketSizeFromSets(allPgSets),
            sets: pgSets,
            allSets: allPgSets,
          })
        }
      }

      phaseGroups.sort((a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0))

      return {
        entrant: {
          id: seedsResult.entrant?.id,
          name: seedsResult.entrant?.name,
          initialSeedNum: seedsResult.entrant?.initialSeedNum,
          paginatedSets: {
            pageInfo: { total: allSets.length, totalPages: 1 },
            nodes: allSets,
          },
        },
        phaseGroups,
      } satisfies EntrantSetsResult
    },
    enabled: !!entrantId,
    staleTime: STALE_TIME_MS.DEFAULT,
  })
}
