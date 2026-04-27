import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { STALE_TIME_MS } from '../lib/constants'

const eventDetailsQuery = graphql(`
  query EventDetails($eventId: ID!) {
    event(id: $eventId) {
      id
      name
      type
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
        isOnline
        images(type: "profile") {
          id
          url
        }
        bannerImages: images(type: "banner") {
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
    staleTime: STALE_TIME_MS.DEFAULT,
  })
}
