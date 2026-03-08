import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const userGamerTagQuery = graphql(`
  query UserGamerTag($slug: String!) {
    user(slug: $slug) {
      id
      player {
        id
        gamerTag
      }
    }
  }
`)

const eventEntrantsQuery = graphql(`
  query EventEntrants($eventId: ID!, $name: String!) {
    event(id: $eventId) {
      id
      entrants(query: { page: 1, perPage: 10, filter: { name: $name } }) {
        nodes {
          id
          name
          participants {
            id
            gamerTag
            user {
              id
              slug
            }
            player {
              id
            }
          }
        }
      }
    }
  }
`)

export function useUserEntrant(eventId: string, discriminator: string | undefined) {
  const slug = discriminator ? `user/${discriminator}` : undefined

  const userQuery = useQuery({
    queryKey: ['userGamerTag', slug],
    queryFn: async () => {
      const result = await graphqlClient.request(userGamerTagQuery, {
        slug: slug!,
      })
      return result.user?.player?.gamerTag ?? null
    },
    enabled: !!slug,
    staleTime: Infinity,
  })

  const gamerTag = userQuery.data

  const entrantQuery = useQuery({
    queryKey: ['userEntrant', eventId, discriminator],
    queryFn: async () => {
      const result = await graphqlClient.request(eventEntrantsQuery, {
        eventId,
        name: gamerTag!,
      })
      const entrants = result.event?.entrants?.nodes
      if (!entrants) return null

      for (const entrant of entrants) {
        if (!entrant) continue
        for (const participant of entrant.participants ?? []) {
          if (participant?.user?.slug === slug) {
            return {
              entrantId: entrant.id!,
              entrantName: entrant.name,
              playerId: participant?.player?.id ?? null,
            }
          }
        }
      }
      return null
    },
    enabled: !!eventId && !!gamerTag,
    staleTime: 5 * 60 * 1000,
  })

  return entrantQuery
}
