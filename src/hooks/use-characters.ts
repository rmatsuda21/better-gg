import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const videogameCharactersQuery = graphql(`
  query VideogameCharacters($videogameId: ID!) {
    videogame(id: $videogameId) {
      id
      name
      characters {
        id
        name
      }
    }
  }
`)

export function useCharacters(videogameId: string | undefined) {
  return useQuery({
    queryKey: ['characters', videogameId],
    queryFn: () =>
      graphqlClient.request(videogameCharactersQuery, {
        videogameId: videogameId!,
      }),
    enabled: !!videogameId,
    staleTime: 24 * 60 * 60 * 1000,
  })
}
