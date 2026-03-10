import { useInfiniteQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const playerRecentEventsQuery = graphql(`
  query PlayerRecentEvents(
    $playerId: ID!
    $userId: ID!
    $page: Int!
    $perPage: Int!
    $videogameId: [ID]
  ) {
    player(id: $playerId) {
      user {
        tournaments(
          query: {
            page: $page
            perPage: $perPage
            filter: { past: true, videogameId: $videogameId }
          }
        ) {
          pageInfo {
            total
            totalPages
            page
            perPage
          }
          nodes {
            name
            startAt
            isOnline
            events(filter: { videogameId: $videogameId }) {
              id
              name
              numEntrants
              userEntrant(userId: $userId) {
                standing {
                  placement
                }
              }
            }
          }
        }
      }
    }
  }
`)

export function usePlayerRecentEvents(
  playerId: string | undefined,
  userId: string | undefined,
  videogameId?: string,
) {
  return useInfiniteQuery({
    queryKey: ['playerRecentEvents', playerId, userId, videogameId],
    queryFn: ({ pageParam }) =>
      graphqlClient.request(playerRecentEventsQuery, {
        playerId: playerId!,
        userId: userId!,
        page: pageParam,
        perPage: 50,
        videogameId: videogameId ? [videogameId] : null,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const pageInfo = lastPage?.player?.user?.tournaments?.pageInfo
      if (!pageInfo) return undefined
      if (allPages.length >= 3) return undefined
      if (pageInfo.page != null && pageInfo.totalPages != null && pageInfo.page >= pageInfo.totalPages) return undefined
      return (pageInfo.page ?? 0) + 1
    },
    enabled: !!playerId && !!userId,
    staleTime: 10 * 60 * 1000,
  })
}
