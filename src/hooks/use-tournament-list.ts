import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'
import { extractApiSearchTerm, matchesAllQueryWords } from '../lib/tournament-search-utils'
import { useDebouncedValue } from './use-debounced-value'
import { PAGINATION, STALE_TIME_MS, TIMING_MS, TIME_WINDOWS } from '../lib/constants'

const THREE_YEARS_CUTOFF_S = Math.floor(Date.now() / 1000) + TIME_WINDOWS.THREE_YEARS_S
const LIVE_WINDOW_S = 30 * 24 * 60 * 60

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
  status?: 'all' | 'upcoming' | 'live' | 'past'
  featured?: boolean
  regOpen?: boolean
  staffPicks?: boolean
  hasBanner?: boolean
  minEntrants?: number
  after?: number
  before?: number
  game?: string
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
    staffPicks,
    hasBanner,
    minEntrants,
    after,
    before,
    game,
    sortBy = 'startAt desc',
    perPage = PAGINATION.TOURNAMENT_LIST,
  } = options

  const debouncedName = useDebouncedValue(name?.trim() ?? '', TIMING_MS.TOURNAMENT_SEARCH_DEBOUNCE)
  const apiTerm = debouncedName ? extractApiSearchTerm(debouncedName) : ''
  const isMultiWord = debouncedName.includes(' ')
  const effectivePerPage = isMultiWord ? Math.max(perPage, PAGINATION.TOURNAMENT_LIST_MULTI_WORD) : perPage

  const gameIds = game ? [game] : ALL_SMASH_VIDEOGAME_IDS

  const [nowSec] = useState(() => Math.floor(Date.now() / 1000))

  // 'live' isn't an API flag — narrow the API window to recently-started tournaments
  // (and ignore the user's after/before in that mode); the client-side memo below
  // then keeps only ones still in progress.
  const isLive = status === 'live'
  const effectiveAfter = isLive ? nowSec - LIVE_WINDOW_S : after
  const effectiveBefore = isLive ? nowSec : before

  const queryKey = [
    'tournamentList', debouncedName, countryCode, addrState,
    online, status, featured, regOpen, staffPicks, hasBanner,
    effectiveAfter, effectiveBefore, game, sortBy, perPage,
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
        videogameIds: gameIds,
      }

      if (debouncedName) filter.name = apiTerm
      if (countryCode) filter.countryCode = countryCode
      if (addrState) filter.addrState = addrState
      if (online === 'online') filter.hasOnlineEvents = true
      if (status === 'upcoming') filter.upcoming = true
      if (status === 'past') filter.past = true
      if (featured) filter.isFeatured = true
      if (regOpen) filter.regOpen = true
      if (staffPicks) filter.staffPicks = true
      if (hasBanner) filter.hasBannerImages = true
      if (effectiveAfter) filter.afterDate = effectiveAfter
      if (effectiveBefore) filter.beforeDate = effectiveBefore

      return graphqlClient.request({
        document: tournamentListQuery,
        variables: { page: pageParam, perPage: effectivePerPage, sortBy, filter, smashGameIds: gameIds },
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
    staleTime: STALE_TIME_MS.TOURNAMENT_LIST,
  })

  const tournaments = useMemo(() => {
    const allNodes = data?.pages.flatMap((p) => p?.tournaments?.nodes ?? []) ?? []

    let filtered = isMultiWord && debouncedName
      ? allNodes.filter((t) => t && matchesAllQueryWords(t.name ?? '', debouncedName))
      : allNodes

    if (online === 'offline') {
      filtered = filtered.filter((t) => t && !t.isOnline)
    }

    filtered = filtered.filter(
      (t) => !t?.startAt || t.startAt < THREE_YEARS_CUTOFF_S,
    )

    if (minEntrants && minEntrants > 0) {
      filtered = filtered.filter((t) =>
        (t?.events ?? []).some((e) => (e?.numEntrants ?? 0) >= minEntrants),
      )
    }

    if (status === 'live') {
      filtered = filtered.filter(
        (t) => t?.startAt != null && t?.endAt != null && t.startAt <= nowSec && t.endAt >= nowSec,
      )
    }

    return filtered
  }, [data?.pages, isMultiWord, debouncedName, online, minEntrants, status, nowSec])

  const hasMinEntrants = !!(minEntrants && minEntrants > 0)
  const isLiveFilter = status === 'live'
  const isClientFiltered = (isMultiWord && !!debouncedName) || hasMinEntrants || isLiveFilter
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
