import { useInfiniteQuery } from '@tanstack/react-query'
import { graphql } from '../gql'
import type { TournamentPageFilter } from '../gql/graphql'
import { graphqlClient } from '../lib/graphql-client'
import { ALL_SMASH_VIDEOGAME_IDS } from '../lib/smash-games'
import { STALE_TIME_MS } from '../lib/constants'

const featuredEventsQuery = graphql(`
  query FeaturedEvents($page: Int!, $perPage: Int!, $filter: TournamentPageFilter, $smashGameIds: [ID]) {
    tournaments(query: {
      page: $page, perPage: $perPage, sortBy: "startAt asc",
      filter: $filter
    }) {
      pageInfo { total totalPages page }
      nodes {
        id name slug startAt endAt numAttendees
        city addrState countryCode isOnline venueName
        images(type: "profile") { id url }
        bannerImages: images(type: "banner") { id url }
        events(limit: 5, filter: { videogameId: $smashGameIds }) {
          id
          name
          numEntrants
        }
      }
    }
  }
`)

const LOOKAHEAD_S = 14 * 24 * 60 * 60
const PAGE_SIZE = 50
const MAX_PAGES = 8

export const FEATURED_MIN_ENTRANTS = 50

export function useFeaturedEvents() {
  return useInfiniteQuery({
    queryKey: ['featuredEvents'],
    queryFn: ({ pageParam }) => {
      const now = Math.floor(Date.now() / 1000)
      const filter: TournamentPageFilter = {
        videogameIds: ALL_SMASH_VIDEOGAME_IDS,
        afterDate: now,
        beforeDate: now + LOOKAHEAD_S,
      }
      return graphqlClient.request(featuredEventsQuery, {
        page: pageParam,
        perPage: PAGE_SIZE,
        filter,
        smashGameIds: ALL_SMASH_VIDEOGAME_IDS,
      })
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const pageInfo = lastPage?.tournaments?.pageInfo
      if (!pageInfo) return undefined
      if (allPages.length >= MAX_PAGES) return undefined
      if (
        pageInfo.page != null &&
        pageInfo.totalPages != null &&
        pageInfo.page >= pageInfo.totalPages
      ) {
        return undefined
      }
      return (pageInfo.page ?? 0) + 1
    },
    staleTime: STALE_TIME_MS.TOURNAMENT_LIST,
  })
}
