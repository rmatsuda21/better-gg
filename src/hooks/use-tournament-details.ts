import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'

const tournamentDetailsQuery = graphql(`
  query TournamentDetails($tournamentId: ID, $slug: String, $smashGameIds: [ID]) {
    tournament(id: $tournamentId, slug: $slug) {
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
      venueAddress
      lat
      lng
      mapsPlaceId
      images(type: "profile") {
        id
        url
      }
      bannerImages: images(type: "banner") {
        id
        url
      }
      events(filter: { videogameId: $smashGameIds }) {
        id
        name
        slug
        startAt
        state
        numEntrants
        isOnline
        videogame {
          id
          name
        }
        phases {
          id
          name
          phaseOrder
          bracketType
          state
          groupCount
          numSeeds
        }
      }
    }
  }
`)

export function useTournamentDetails(identifier: string) {
  const isSlug = !/^\d+$/.test(identifier)
  return useQuery({
    queryKey: ['tournamentDetails', identifier],
    queryFn: () =>
      graphqlClient.request(tournamentDetailsQuery, {
        tournamentId: isSlug ? undefined : identifier,
        slug: isSlug ? `tournament/${identifier}` : undefined,
        smashGameIds: ALL_SMASH_VIDEOGAME_IDS,
      }),
    enabled: !!identifier,
    staleTime: 5 * 60 * 1000,
  })
}
