import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { useDebouncedValue } from './use-debounced-value'

const ULTIMATE_VIDEOGAME_ID = '1386'

const tournamentSearchQuery = graphql(`
  query TournamentSearch($perPage: Int!, $filter: TournamentPageFilter) {
    tournaments(query: {
      perPage: $perPage, page: 1, sortBy: "startAt desc",
      filter: $filter
    }) {
      nodes {
        id name slug startAt endAt numAttendees
        city addrState countryCode isOnline
        images(type: "profile") { id url }
        events(limit: 3) { id name numEntrants }
      }
    }
  }
`)

interface TournamentSearchOptions {
  countryCode?: string
}

export function useTournamentSearch(query: string, options?: TournamentSearchOptions) {
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const countryCode = options?.countryCode

  const { data, isLoading } = useQuery({
    queryKey: ['tournamentSearch', debouncedQuery, countryCode],
    queryFn: ({ signal }) => {
      const filter: TournamentPageFilter = {
        name: debouncedQuery,
        videogameIds: [ULTIMATE_VIDEOGAME_ID],
      }
      if (countryCode) filter.countryCode = countryCode
      return graphqlClient.request({
        document: tournamentSearchQuery,
        variables: { perPage: 8, filter },
        signal,
      })
    },
    enabled: debouncedQuery.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  return {
    results: data?.tournaments?.nodes ?? [],
    isLoading: isLoading && debouncedQuery.length >= 3,
  }
}
