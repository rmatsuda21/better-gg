// Role determined by usage frequency relative to most-played character
type CharacterRole = 'main' | 'co-main' | 'secondary'

export interface CharacterEntry {
  id: number         // character ID
  role: CharacterRole
  pct: number        // usage percentage (0-100)
}

export interface PlayerRecord {
  pid: string        // player ID
  tag: string        // gamerTag
  pfx: string | null // sponsor prefix
  disc: string | null // user discriminator
  cc: string | null  // ISO country code
  chars: CharacterEntry[] // characters sorted by usage (main first)
  tc: number         // tournament count in index
}
