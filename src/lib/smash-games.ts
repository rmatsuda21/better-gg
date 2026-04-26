// All official Super Smash Bros. videogame IDs on start.gg
// Verified via: videogames(query: { filter: { name: "Super Smash Bros" } })
export const SMASH_GAME_IDS = {
  SSB64: '4',
  MELEE: '1',
  BRAWL: '5',
  SMASH4_WIIU: '3',
  SMASH4_3DS: '29',
  ULTIMATE: '1386',
} as const

// Array of all Smash game IDs — used for GraphQL [ID] array filters
export const ALL_SMASH_VIDEOGAME_IDS: string[] = Object.values(SMASH_GAME_IDS)

// Ultimate specifically — used for character queries, rankings, recentStandings
export const ULTIMATE_VIDEOGAME_ID = SMASH_GAME_IDS.ULTIMATE

// Check if a videogame ID is a Smash game
const smashIdSet = new Set<string>(ALL_SMASH_VIDEOGAME_IDS)
export function isSmashGame(videogameId: string | number | null | undefined): boolean {
  if (videogameId == null) return false
  return smashIdSet.has(String(videogameId))
}
