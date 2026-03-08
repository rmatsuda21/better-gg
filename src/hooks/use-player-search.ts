import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { searchPlayers } from '../lib/player-search'

export function usePlayerSearch(query: string) {
  const debouncedQuery = useDebouncedValue(query.trim(), 200)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['playerSearch', debouncedQuery],
    queryFn: () => searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: Infinity,
  })

  return {
    results: data ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
    isSearching: isFetching,
  }
}
