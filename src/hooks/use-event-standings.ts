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

export function useEventStandings(
  eventId: string,
  page: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['eventStandings', eventId, page],
    queryFn: () =>
      graphqlClient.request(eventStandingsQuery, {
        eventId,
        page,
        perPage: 25,
      }),
    enabled: enabled && !!eventId,
    staleTime: 5 * 60 * 1000,
  })
}
