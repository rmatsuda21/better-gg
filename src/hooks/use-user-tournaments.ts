import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'

const userTournamentsQuery = graphql(`
  query UserTournaments($slug: String!, $perPage: Int!, $videogameId: [ID]) {
    user(slug: $slug) {
      id
      tournaments(
        query: { page: 1, perPage: $perPage, filter: { videogameId: $videogameId } }
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
          events(filter: { videogameId: $videogameId }) {
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
        perPage: 20,
        videogameId: ALL_SMASH_VIDEOGAME_IDS,
      }),
    enabled: !!discriminator,
    staleTime: 5 * 60 * 1000,
  })
}
