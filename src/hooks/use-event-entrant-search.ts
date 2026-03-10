import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const eventEntrantSearchQuery = graphql(`
  query EventEntrantSearch($eventId: ID!, $name: String!) {
    event(id: $eventId) {
      id
      entrants(query: { page: 1, perPage: 20, filter: { name: $name } }) {
        nodes {
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
          standing {
            placement
            isFinal
          }
        }
      }
    }
  }
`)

export function useEventEntrantSearch(
  eventId: string,
  name: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['eventEntrantSearch', eventId, name],
    queryFn: () =>
      graphqlClient.request(eventEntrantSearchQuery, { eventId, name }),
    enabled: enabled && !!eventId && name.length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}
