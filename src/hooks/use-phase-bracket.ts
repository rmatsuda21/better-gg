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
      seeds(query: { page: 1, perPage: 1 }) {
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

export interface PhaseBracketResult {
  phaseName: string | null
  bracketType: string | null
  phaseState: string | null
  eventState: string | null
  eventId: string | null
  currentPhaseOrder: number | null
  siblingPhases: SiblingPhaseInfo[]
  phaseGroups: PhaseGroupInfo[]
  progressionMap: Map<string, SetProgressionInfo>
  originPhaseIds: string[]
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
      const isStarted = phase.state === 'ACTIVE' || phase.state === 'COMPLETED'
      const query = isStarted ? phaseBracketSetsActiveQuery : phaseBracketSetsCreatedQuery
      const perPage = isStarted ? 50 : 35

      // Step 2: fetch sets per phase group in parallel
      const pgResults = await Promise.all(
        pgNodes.map(async (pg) => {
          if (!pg?.id) return null
          const nodes = await fetchPhaseGroupSets(pg.id, query, perPage)
          return { pgId: pg.id, displayIdentifier: pg.displayIdentifier, nodes }
        })
      )

      // Step 3: build PhaseGroupInfo[] + progressionMap from results
      const phaseGroups: PhaseGroupInfo[] = []
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

      // Extract origin phase IDs from progressingInData (origin is an Int phase ID)
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
        progressionMap,
        originPhaseIds,
      }
    },
    enabled: !!phaseId,
    staleTime: 5 * 60 * 1000,
  })
}
