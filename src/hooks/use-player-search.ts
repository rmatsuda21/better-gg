import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { searchPlayers, getCountries } from '../lib/player-search'
import { STALE_TIME_MS, THRESHOLDS } from '../lib/constants'

export function usePlayerSearch(query: string, country?: string) {
  const debouncedQuery = useDebouncedValue(query.trim())

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['playerSearch', debouncedQuery, country],
    queryFn: () => searchPlayers(debouncedQuery, 10, country),
    enabled: debouncedQuery.length >= THRESHOLDS.MIN_PLAYER_SEARCH_LENGTH,
    staleTime: STALE_TIME_MS.NEVER,
  })

  return {
    results: data ?? [],
    isLoading: isLoading && debouncedQuery.length >= THRESHOLDS.MIN_PLAYER_SEARCH_LENGTH,
    isSearching: isFetching,
  }
}

export function usePlayerCountries() {
  return useQuery({
    queryKey: ['playerCountries'],
    queryFn: getCountries,
    staleTime: STALE_TIME_MS.NEVER,
  })
}
