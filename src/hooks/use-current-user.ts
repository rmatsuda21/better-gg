import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { getAuthToken, setAuthUser } from '../lib/auth'
import type { AuthUser } from '../lib/auth'

const currentUserQuery = graphql(`
  query CurrentUser {
    currentUser {
      id
      slug
      name
      player {
        id
        gamerTag
      }
      images(type: "profile") {
        url
      }
    }
  }
`)

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const data = await graphqlClient.request(currentUserQuery)
      const u = data.currentUser
      if (u) {
        const slug = u.slug ?? ''
        const disc = slug.startsWith('user/') ? slug.slice(5) : slug
        const authUser: AuthUser = {
          id: String(u.id ?? ''),
          slug,
          discriminator: disc,
          name: u.name ?? null,
          gamerTag: u.player?.gamerTag ?? null,
          profileImageUrl: u.images?.[0]?.url ?? null,
        }
        setAuthUser(authUser)
      }
      return data
    },
    enabled: !!getAuthToken(),
    staleTime: 30 * 60 * 1000,
  })
}
