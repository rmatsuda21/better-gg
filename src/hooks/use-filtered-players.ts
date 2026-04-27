import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { getAllPlayers, searchPlayersAll } from '../lib/player-search'
import { filterPlayers, sortPlayersByActivity } from '../lib/player-filter'
import type { PlayerRecord } from '../lib/player-search-types'
import { STALE_TIME_MS, THRESHOLDS } from '../lib/constants'

export function useFilteredPlayers(options: {
  query: string
  country?: string
  characterId?: number
}): { players: PlayerRecord[]; total: number; isLoading: boolean } {
  const debouncedQuery = useDebouncedValue(options.query.trim())

  const { data, isLoading } = useQuery({
    queryKey: [
      'filteredPlayers',
      debouncedQuery,
      options.country,
      options.characterId,
    ],
    queryFn: async (): Promise<PlayerRecord[]> => {
      let players: PlayerRecord[]
      if (debouncedQuery.length >= THRESHOLDS.MIN_PLAYER_SEARCH_LENGTH) {
        players = await searchPlayersAll(debouncedQuery)
      } else {
        players = sortPlayersByActivity(await getAllPlayers())
      }
      return filterPlayers(players, {
        country: options.country,
        characterId: options.characterId,
      })
    },
    staleTime: STALE_TIME_MS.NEVER,
  })

  const players = data ?? []
  return { players, total: players.length, isLoading }
}
