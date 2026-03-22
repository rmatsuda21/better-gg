import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const setDetailsQuery = graphql(`
  query SetDetails($setId: ID!) {
    set(id: $setId) {
      id
      winnerId
      fullRoundText
      displayScore
      slots {
        id
        entrant {
          id
          name
          participants {
            id
            player { id }
          }
        }
        seed {
          entrant {
            id
            name
            participants {
              id
              player { id }
            }
          }
        }
      }
      games {
        orderNum
        winnerId
        entrant1Score
        entrant2Score
        selections {
          entrant { id }
          selectionType
          selectionValue
        }
        stage { id name }
      }
    }
  }
`)

export function useSetDetails(setId: string | null) {
  return useQuery({
    queryKey: ['setDetails', setId],
    queryFn: () => graphqlClient.request(setDetailsQuery, { setId: setId! }),
    enabled: !!setId,
    staleTime: 5 * 60 * 1000,
  })
}
