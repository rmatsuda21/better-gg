import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { useDebouncedValue } from './use-debounced-value'

const ULTIMATE_VIDEOGAME_ID = '1386'

const tournamentListQuery = graphql(`
  query TournamentList($page: Int!, $perPage: Int!, $sortBy: String, $filter: TournamentPageFilter) {
    tournaments(query: {
      page: $page, perPage: $perPage, sortBy: $sortBy,
      filter: $filter
    }) {
      pageInfo { total totalPages page perPage }
      nodes {
        id name slug startAt endAt numAttendees
        city addrState countryCode isOnline
        images(type: "profile") { id url }
        events(limit: 5, filter: { videogameId: [1386] }) { id name numEntrants }
      }
    }
  }
`)

export interface TournamentListOptions {
  name?: string
  countryCode?: string
  addrState?: string
  online?: 'all' | 'online' | 'offline'
  status?: 'all' | 'upcoming' | 'past'
  featured?: boolean
  regOpen?: boolean
  sortBy?: string
  page?: number
  perPage?: number
}

export function useTournamentList(options: TournamentListOptions) {
  const {
    name,
    countryCode,
    addrState,
    online = 'all',
    status = 'all',
    featured,
    regOpen,
    sortBy = 'startAt desc',
    page = 1,
    perPage = 24,
  } = options

  const debouncedName = useDebouncedValue(name?.trim() ?? '', 300)

  const queryKey = [
    'tournamentList', debouncedName, countryCode, addrState,
    online, status, featured, regOpen, sortBy, page, perPage,
  ]

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      const filter: TournamentPageFilter = {
        videogameIds: [ULTIMATE_VIDEOGAME_ID],
      }

      if (debouncedName) filter.name = debouncedName
      if (countryCode) filter.countryCode = countryCode
      if (addrState) filter.addrState = addrState
      if (online === 'online') filter.hasOnlineEvents = true
      if (status === 'upcoming') filter.upcoming = true
      if (status === 'past') filter.past = true
      if (featured) filter.isFeatured = true
      if (regOpen) filter.regOpen = true

      return graphqlClient.request({
        document: tournamentListQuery,
        variables: { page, perPage, sortBy, filter },
        signal,
      })
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const nodes = data?.tournaments?.nodes ?? []
  // Client-side offline filter (API only has hasOnlineEvents for online)
  const tournaments = online === 'offline'
    ? nodes.filter((t) => t && !t.isOnline)
    : nodes

  return {
    tournaments,
    pageInfo: data?.tournaments?.pageInfo ?? null,
    isLoading,
    isFetching,
    isError,
    error,
  }
}
