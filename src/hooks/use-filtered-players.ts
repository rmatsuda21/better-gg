import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import { getAllPlayers, searchPlayersAll } from '../lib/player-search'
import { filterPlayers, sortPlayersByActivity } from '../lib/player-filter'
import type { PlayerRecord } from '../lib/player-search-types'

const PAGE_SIZE = 50

export function useFilteredPlayers(options: {
  query: string
  country?: string
  characterId?: number
  page: number
}) {
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

  const all = data ?? []
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(options.page, totalPages)
  const start = (page - 1) * PAGE_SIZE
  const players = all.slice(start, start + PAGE_SIZE)

  return { players, total, totalPages, page, isLoading }
}
