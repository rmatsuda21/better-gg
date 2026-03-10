import type { PlayerRecord } from './player-search-types'

export function filterPlayers(
  players: PlayerRecord[],
  filters: { country?: string; characterId?: number },
): PlayerRecord[] {
  let result = players
  if (filters.country) {
    result = result.filter((p) => p.cc === filters.country)
  }
  if (filters.characterId != null) {
    result = result.filter((p) =>
      p.chars.some((ch) => ch.id === filters.characterId),
    )
  }
  return result
}

export function sortPlayersByActivity(players: PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((a, b) => b.tc - a.tc)
}
