import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const userTournamentsQuery = graphql(`
  query UserTournaments($slug: String!, $perPage: Int!) {
    user(slug: $slug) {
      id
      tournaments(
        query: { page: 1, perPage: $perPage }
      ) {
        pageInfo {
          total
          totalPages
        }
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
            id
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
`)

export function useUserTournaments(discriminator: string) {
  const slug = `user/${discriminator}`
  return useQuery({
    queryKey: ['userTournaments', slug],
    queryFn: () =>
      graphqlClient.request(userTournamentsQuery, {
        slug,
        perPage: 5,
      }),
    enabled: !!discriminator,
    staleTime: 5 * 60 * 1000,
  })
}
