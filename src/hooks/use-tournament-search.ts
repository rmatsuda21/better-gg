import { useQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'
import { extractApiSearchTerm, matchesAllQueryWords } from '../lib/tournament-search-utils'
import { useDebouncedValue } from './use-debounced-value'

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

  const apiTerm = debouncedQuery ? extractApiSearchTerm(debouncedQuery) : ''
  const isMultiWord = debouncedQuery.includes(' ')

  const { data, isLoading } = useQuery({
    queryKey: ['tournamentSearch', debouncedQuery, countryCode],
    queryFn: ({ signal }) => {
      const filter: TournamentPageFilter = {
        name: apiTerm,
        videogameIds: ALL_SMASH_VIDEOGAME_IDS,
      }
      if (countryCode) filter.countryCode = countryCode
      return graphqlClient.request({
        document: tournamentSearchQuery,
        variables: { perPage: isMultiWord ? 30 : 8, filter },
        signal,
      })
    },
    enabled: debouncedQuery.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  const rawNodes = data?.tournaments?.nodes ?? []
  const filtered = isMultiWord
    ? rawNodes.filter((t) => t != null && matchesAllQueryWords(t.name ?? '', debouncedQuery))
    : rawNodes

  return {
    results: filtered.slice(0, 8),
    isLoading: isLoading && debouncedQuery.length >= 3,
  }
}
