import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'

const playerUpcomingEventsQuery = graphql(`
  query PlayerUpcomingEvents($playerId: ID!, $perPage: Int!, $videogameId: [ID]) {
    player(id: $playerId) {
      user {
        tournaments(
          query: {
            page: 1
            perPage: $perPage
            filter: { upcoming: true, videogameId: $videogameId }
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
            events(filter: { videogameId: $videogameId }) {
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
        perPage: 8,
        videogameId: ALL_SMASH_VIDEOGAME_IDS,
      }),
    enabled: !!playerId && !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
