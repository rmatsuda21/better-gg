import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { searchPlayers, getCountries } from '../lib/player-search'

export function usePlayerSearch(query: string, country?: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 200)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['playerSearch', debouncedQuery, country],
    queryFn: () => searchPlayers(debouncedQuery, 10, country),
    enabled: debouncedQuery.length >= 2,
    staleTime: Infinity,
  })

  return {
    results: data ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
    isSearching: isFetching,
  }
}

export function usePlayerCountries() {
  return useQuery({
    queryKey: ['playerCountries'],
    queryFn: getCountries,
    staleTime: Infinity,
  })
}
