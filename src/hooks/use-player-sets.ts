import { useInfiniteQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const playerSetsQuery = graphql(`
  query PlayerSets($playerId: ID!, $page: Int!, $perPage: Int!) {
    player(id: $playerId) {
      id
      sets(page: $page, perPage: $perPage) {
        pageInfo {
          total
          totalPages
          page
        }
        nodes {
          id
          winnerId
          event {
            id
            videogame {
              id
            }
          }
          slots {
            entrant {
              id
              participants {
                player {
                  id
                }
              }
            }
          }
          games {
            selections {
              entrant {
                id
              }
              selectionType
              selectionValue
            }
          }
        }
      }
    }
  }
`)

export function usePlayerSets(
  playerId: string | undefined,
  maxPages = 6,
) {
  return useInfiniteQuery({
    queryKey: ['playerSets', playerId],
    queryFn: ({ pageParam }) =>
      graphqlClient.request(playerSetsQuery, {
        playerId: playerId!,
        page: pageParam,
        perPage: 25,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const pageInfo = lastPage?.player?.sets?.pageInfo
      if (!pageInfo) return undefined
      if (allPages.length >= maxPages) return undefined
      if (
        pageInfo.page != null &&
        pageInfo.totalPages != null &&
        pageInfo.page >= pageInfo.totalPages
      )
        return undefined
      return (pageInfo.page ?? 0) + 1
    },
    enabled: !!playerId,
    staleTime: 10 * 60 * 1000,
  })
}
