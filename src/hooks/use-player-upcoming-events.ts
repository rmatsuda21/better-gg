import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const playerUpcomingEventsQuery = graphql(`
  query PlayerUpcomingEvents($playerId: ID!, $perPage: Int!) {
    player(id: $playerId) {
      user {
        tournaments(
          query: {
            page: 1
            perPage: $perPage
            filter: { upcoming: true }
          }
        ) {
          nodes {
            id
            name
            slug
            startAt
            endAt
            numAttendees
            city
            addrState
            countryCode
            isOnline
            venueName
            images(type: "profile") {
              url
            }
            events {
              id
              name
              numEntrants
            }
          }
        }
      }
    }
  }
`)

export function usePlayerUpcomingEvents(
  playerId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ['playerUpcomingEvents', playerId],
    queryFn: () =>
      graphqlClient.request(playerUpcomingEventsQuery, {
        playerId: playerId!,
        perPage: 20,
      }),
    enabled: !!playerId && !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
