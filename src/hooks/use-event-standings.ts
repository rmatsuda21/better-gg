import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { resolveEntrantDisplay } from '../lib/bracket-utils'
import { PAGINATION, STALE_TIME_MS } from '../lib/constants'

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

export interface EventStandingParticipant {
  gamerTag: string
  prefix: string | null
  playerId: string | null
}

export interface EventStanding {
  id: string
  placement: number | null
  seed: number | null
  name: string | null
  prefix: string | null
  playerId: string | null
  participants: EventStandingParticipant[]
}

async function fetchAllStandings(eventId: string, isTeamEvent: boolean): Promise<EventStanding[]> {
  const perPage = PAGINATION.EVENT_STANDINGS

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
    const display = node.entrant
      ? resolveEntrantDisplay(node.entrant, isTeamEvent)
      : { name: 'Unknown', prefix: null, playerId: null }
    const participants: EventStandingParticipant[] = (node.entrant?.participants ?? [])
      .filter((p): p is NonNullable<typeof p> => p != null && !!p.gamerTag)
      .map(p => ({
        gamerTag: p.gamerTag!,
        prefix: p.prefix ?? null,
        playerId: p.player?.id ? String(p.player.id) : null,
      }))
    standings.push({
      id: String(node.id),
      placement: node.placement ?? null,
      seed: node.entrant?.initialSeedNum ?? null,
      name: display.name,
      prefix: display.prefix,
      playerId: display.playerId,
      participants,
    })
  }

  return standings
}

export function useAllEventStandings(eventId: string, enabled: boolean, isTeamEvent = false) {
  return useQuery({
    queryKey: ['allEventStandings', eventId],
    queryFn: () => fetchAllStandings(eventId, isTeamEvent),
    enabled: enabled && !!eventId,
    staleTime: STALE_TIME_MS.DEFAULT,
  })
}
