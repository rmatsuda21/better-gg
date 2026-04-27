import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { PAGINATION, STALE_TIME_MS } from '../lib/constants'

const tournamentParticipantsQuery = graphql(`
  query TournamentParticipants($tournamentId: ID!, $page: Int!, $perPage: Int!) {
    tournament(id: $tournamentId) {
      id
      participants(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          gamerTag
          prefix
          player {
            id
          }
          entrants {
            id
            initialSeedNum
            event {
              id
            }
            standing {
              placement
            }
          }
        }
      }
    }
  }
`)

export interface TournamentParticipant {
  id: string
  gamerTag: string
  prefix: string | null
  playerId: string | null
  bestSeed: number | null
  entrants: Array<{
    entrantId: string
    eventId: string
    seed: number | null
    placement: number | null
  }>
}

async function fetchAllParticipants(
  tournamentId: string,
): Promise<TournamentParticipant[]> {
  const perPage = PAGINATION.TOURNAMENT_PARTICIPANTS

  const firstPage = await graphqlClient.request(tournamentParticipantsQuery, {
    tournamentId,
    page: 1,
    perPage,
  })

  const allNodes = [...(firstPage.tournament?.participants?.nodes ?? [])]
  const totalPages =
    firstPage.tournament?.participants?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(tournamentParticipantsQuery, {
          tournamentId,
          page: i + 2,
          perPage,
        }),
      ),
    )
    for (const r of remaining) {
      allNodes.push(...(r.tournament?.participants?.nodes ?? []))
    }
  }

  const seen = new Set<string>()
  const participants: TournamentParticipant[] = []
  for (const node of allNodes) {
    if (!node?.id || !node.gamerTag) continue
    const id = String(node.id)
    if (seen.has(id)) continue
    seen.add(id)
    const entrants = (node.entrants ?? [])
      .filter((e) => e?.id && e.event?.id)
      .map((e) => ({
        entrantId: String(e!.id),
        eventId: String(e!.event!.id),
        seed: e!.initialSeedNum ?? null,
        placement: e!.standing?.placement ?? null,
      }))

    const seeds = entrants
      .map((e) => e.seed)
      .filter((s): s is number => s != null)
    const bestSeed = seeds.length > 0 ? Math.min(...seeds) : null

    participants.push({
      id: String(node.id),
      gamerTag: node.gamerTag,
      prefix: node.prefix ?? null,
      playerId: node.player?.id ? String(node.player.id) : null,
      bestSeed,
      entrants,
    })
  }

  participants.sort((a, b) => {
    if (a.bestSeed == null && b.bestSeed == null) return 0
    if (a.bestSeed == null) return 1
    if (b.bestSeed == null) return -1
    return a.bestSeed - b.bestSeed
  })

  return participants
}

export function useTournamentParticipants(tournamentId: string) {
  return useQuery({
    queryKey: ['tournamentParticipants', tournamentId],
    queryFn: () => fetchAllParticipants(tournamentId),
    enabled: !!tournamentId,
    staleTime: STALE_TIME_MS.DEFAULT,
  })
}
