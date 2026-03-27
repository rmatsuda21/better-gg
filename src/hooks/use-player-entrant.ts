import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const playerGamerTagQuery = graphql(`
  query PlayerGamerTag($playerId: ID!) {
    player(id: $playerId) {
      id
      gamerTag
    }
  }
`)

const playerEventEntrantsQuery = graphql(`
  query PlayerEventEntrants($eventId: ID!, $name: String!) {
    event(id: $eventId) {
      id
      entrants(query: { page: 1, perPage: 10, filter: { name: $name } }) {
        nodes {
          id
          name
          standing {
            placement
          }
          participants {
            id
            gamerTag
            player {
              id
            }
          }
        }
      }
    }
  }
`)

export function usePlayerEntrant(playerId: string, eventId: string) {
  const playerQuery = useQuery({
    queryKey: ['playerGamerTag', playerId],
    queryFn: async () => {
      const result = await graphqlClient.request(playerGamerTagQuery, {
        playerId,
      })
      return result.player?.gamerTag ?? null
    },
    enabled: !!playerId,
    staleTime: Infinity,
  })

  const gamerTag = playerQuery.data

  const entrantQuery = useQuery({
    queryKey: ['playerEntrant', playerId, eventId],
    queryFn: async () => {
      const result = await graphqlClient.request(playerEventEntrantsQuery, {
        eventId,
        name: gamerTag!,
      })
      const entrants = result.event?.entrants?.nodes
      if (!entrants) return null

      for (const entrant of entrants) {
        if (!entrant) continue
        for (const participant of entrant.participants ?? []) {
          if (String(participant?.player?.id) === String(playerId)) {
            return {
              entrantId: entrant.id!,
              entrantName: entrant.name,
              playerId: participant?.player?.id ?? null,
              placement: entrant.standing?.placement ?? null,
            }
          }
        }
      }
      return null
    },
    enabled: !!playerId && !!eventId && !!gamerTag,
    staleTime: 5 * 60 * 1000,
  })

  // Combine loading states: pending while either query is still resolving
  const isLoading = playerQuery.isPending || (gamerTag != null && entrantQuery.isPending)

  return {
    data: entrantQuery.data,
    isLoading,
  }
}
