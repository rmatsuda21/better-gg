import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { STALE_TIME_MS } from '../lib/constants'

const playerStatsQuery = graphql(`
  query PlayerStats($playerId: ID!, $setsPage: Int!, $setsPerPage: Int!, $videogameId: ID) {
    player(id: $playerId) {
      id
      gamerTag
      recentStandings(limit: 20, videogameId: $videogameId) {
        id
        placement
        container {
          ... on Event {
            id
            name
            numEntrants
            tournament {
              name
            }
          }
        }
      }
      sets(page: $setsPage, perPage: $setsPerPage) {
        nodes {
          id
          winnerId
          event {
            videogame {
              id
            }
          }
          slots {
            entrant {
              id
              name
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

export function useOpponentStats(
  playerId: string | undefined,
  enabled: boolean,
  videogameId?: string,
) {
  return useQuery({
    queryKey: ['opponentStats', playerId, videogameId],
    queryFn: () =>
      graphqlClient.request(playerStatsQuery, {
        playerId: playerId!,
        setsPage: 1,
        setsPerPage: 25,
        videogameId: videogameId ?? null,
      }),
    enabled: !!playerId && enabled,
    staleTime: STALE_TIME_MS.OPPONENT_STATS,
  })
}
