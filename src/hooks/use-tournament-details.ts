import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'

const tournamentDetailsQuery = graphql(`
  query TournamentDetails($tournamentId: ID!) {
    tournament(id: $tournamentId) {
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
      events {
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

export function useTournamentDetails(tournamentId: string) {
  return useQuery({
    queryKey: ['tournamentDetails', tournamentId],
    queryFn: () =>
      graphqlClient.request(tournamentDetailsQuery, { tournamentId }),
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000,
  })
}
