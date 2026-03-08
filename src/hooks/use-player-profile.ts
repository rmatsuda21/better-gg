import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const playerProfileQuery = graphql(`
  query PlayerProfile($playerId: ID!, $videogameId: ID) {
    player(id: $playerId) {
      id
      gamerTag
      prefix
      rankings(limit: 3, videogameId: $videogameId) {
        rank
        title
      }
      user {
        id
        name
        bio
        images(type: "profile") {
          url
        }
        location {
          city
          state
          country
        }
        authorizations {
          id
          type
          url
          externalUsername
        }
      }
    }
  }
`)

export function usePlayerProfile(
  playerId: string | undefined,
  videogameId?: string,
) {
  return useQuery({
    queryKey: ['playerProfile', playerId, videogameId],
    queryFn: () =>
      graphqlClient.request(playerProfileQuery, {
        playerId: playerId!,
        videogameId: videogameId ?? null,
      }),
    enabled: !!playerId,
    staleTime: 15 * 60 * 1000,
  })
}
