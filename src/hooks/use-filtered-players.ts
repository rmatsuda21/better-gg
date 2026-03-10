import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { getAllPlayers, searchPlayersAll } from '../lib/player-search'
import { filterPlayers, sortPlayersByActivity } from '../lib/player-filter'
import type { PlayerRecord } from '../lib/player-search-types'

export function useFilteredPlayers(options: {
  query: string
  country?: string
  characterId?: number
}): { players: PlayerRecord[]; total: number; isLoading: boolean } {
  const debouncedQuery = useDebouncedValue(options.query.trim(), 200)

  const { data, isLoading } = useQuery({
    queryKey: [
      'filteredPlayers',
      debouncedQuery,
      options.country,
      options.characterId,
    ],
    queryFn: async (): Promise<PlayerRecord[]> => {
      let players: PlayerRecord[]
      if (debouncedQuery.length >= 2) {
        players = await searchPlayersAll(debouncedQuery)
      } else {
        players = sortPlayersByActivity(await getAllPlayers())
      }
      return filterPlayers(players, {
        country: options.country,
        characterId: options.characterId,
      })
    },
    staleTime: Infinity,
  })

  const players = data ?? []
  return { players, total: players.length, isLoading }
}
