import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const eventDetailsQuery = graphql(`
  query EventDetails($eventId: ID!) {
    event(id: $eventId) {
      id
      name
      slug
      startAt
      state
      numEntrants
      isOnline
      videogame {
        id
        name
      }
      tournament {
        id
        name
        slug
        startAt
        endAt
        city
        addrState
        countryCode
        images(type: "profile") {
          id
          url
        }
      }
      phases {
        id
        name
        bracketType
        state
      }
    }
  }
`)

export function useEventDetails(eventId: string) {
  return useQuery({
    queryKey: ['eventDetails', eventId],
    queryFn: () =>
      graphqlClient.request(eventDetailsQuery, { eventId }),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
  })
}
