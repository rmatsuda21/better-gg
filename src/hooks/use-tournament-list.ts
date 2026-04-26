import { useInfiniteQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'
import { extractApiSearchTerm, matchesAllQueryWords } from '../lib/tournament-search-utils'
import { useDebouncedValue } from './use-debounced-value'

const tournamentListQuery = graphql(`
  query TournamentList($page: Int!, $perPage: Int!, $sortBy: String, $filter: TournamentPageFilter, $smashGameIds: [ID]) {
    tournaments(query: {
      page: $page, perPage: $perPage, sortBy: $sortBy,
      filter: $filter
    }) {
      pageInfo { total totalPages page perPage }
      nodes {
        id name slug startAt endAt numAttendees
        city addrState countryCode isOnline venueName
        images(type: "profile") { id url }
        bannerImages: images(type: "banner") { id url }
        events(limit: 5, filter: { videogameId: $smashGameIds }) { id name numEntrants }
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
    perPage = 24,
  } = options

  const debouncedName = useDebouncedValue(name?.trim() ?? '', 300)
  const apiTerm = debouncedName ? extractApiSearchTerm(debouncedName) : ''
  const isMultiWord = debouncedName.includes(' ')
  const effectivePerPage = isMultiWord ? Math.max(perPage, 60) : perPage

  const queryKey = [
    'tournamentList', debouncedName, countryCode, addrState,
    online, status, featured, regOpen, sortBy, perPage,
  ]

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => {
      const filter: TournamentPageFilter = {
        videogameIds: ALL_SMASH_VIDEOGAME_IDS,
      }

      if (debouncedName) filter.name = apiTerm
      if (countryCode) filter.countryCode = countryCode
      if (addrState) filter.addrState = addrState
      if (online === 'online') filter.hasOnlineEvents = true
      if (status === 'upcoming') filter.upcoming = true
      if (status === 'past') filter.past = true
      if (featured) filter.isFeatured = true
      if (regOpen) filter.regOpen = true

      return graphqlClient.request({
        document: tournamentListQuery,
        variables: { page: pageParam, perPage: effectivePerPage, sortBy, filter, smashGameIds: ALL_SMASH_VIDEOGAME_IDS },
        signal,
      })
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pageInfo = lastPage?.tournaments?.pageInfo
      if (!pageInfo) return undefined
      if (pageInfo.page != null && pageInfo.totalPages != null && pageInfo.page >= pageInfo.totalPages) return undefined
      return (pageInfo.page ?? 0) + 1
    },
    staleTime: 2 * 60 * 1000,
  })

  const allNodes = data?.pages.flatMap((p) => p?.tournaments?.nodes ?? []) ?? []
  // Client-side multi-word filter (API name filter does broad OR matching)
  let tournaments = isMultiWord && debouncedName
    ? allNodes.filter((t) => t && matchesAllQueryWords(t.name ?? '', debouncedName))
    : allNodes
  // Client-side offline filter (API only has hasOnlineEvents for online)
  if (online === 'offline') {
    tournaments = tournaments.filter((t) => t && !t.isOnline)
  }

  const isClientFiltered = isMultiWord && !!debouncedName
  const apiTotal = data?.pages[0]?.tournaments?.pageInfo?.total ?? 0
  const total = isClientFiltered ? tournaments.length : apiTotal

  return {
    tournaments,
    total,
    isClientFiltered,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
  }
}
