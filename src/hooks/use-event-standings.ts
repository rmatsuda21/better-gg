import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const eventStandingsQuery = graphql(`
  query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      standings(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
          page
          perPage
        }
        nodes {
          id
          placement
          isFinal
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
`)

export interface EventStanding {
  id: string
  placement: number | null
  seed: number | null
  name: string | null
  prefix: string | null
  playerId: string | null
}

async function fetchAllStandings(eventId: string): Promise<EventStanding[]> {
  const perPage = 100

  const firstPage = await graphqlClient.request(eventStandingsQuery, {
    eventId,
    page: 1,
    perPage,
  })

  const allNodes = [...(firstPage.event?.standings?.nodes ?? [])]
  const totalPages =
    firstPage.event?.standings?.pageInfo?.totalPages ?? 1

  if (totalPages > 1) {
    const remaining = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        graphqlClient.request(eventStandingsQuery, {
          eventId,
          page: i + 2,
          perPage,
        }),
      ),
    )
    for (const r of remaining) {
      allNodes.push(...(r.event?.standings?.nodes ?? []))
    }
  }

  const standings: EventStanding[] = []
  for (const node of allNodes) {
    if (!node?.id) continue
    const participant = node.entrant?.participants?.[0]
    standings.push({
      id: String(node.id),
      placement: node.placement ?? null,
      seed: node.entrant?.initialSeedNum ?? null,
      name: node.entrant?.name ?? null,
      prefix: participant?.prefix ?? null,
      playerId: participant?.player?.id ? String(participant.player.id) : null,
    })
  }

  return standings
}

export function useAllEventStandings(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['allEventStandings', eventId],
    queryFn: () => fetchAllStandings(eventId),
    enabled: enabled && !!eventId,
    staleTime: 5 * 60 * 1000,
  })
}
