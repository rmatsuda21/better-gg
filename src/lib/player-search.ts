import Fuse from 'fuse.js'
import type { PlayerRecord } from './player-search-types'

let fuseIndex: Fuse<PlayerRecord> | null = null
let loadPromise: Promise<Fuse<PlayerRecord>> | null = null

async function loadIndex(): Promise<Fuse<PlayerRecord>> {
  if (fuseIndex) return fuseIndex

  if (!loadPromise) {
    loadPromise = fetch('/data/players.json')
      .then((res) => res.json())
      .then((players: PlayerRecord[]) => {
        fuseIndex = new Fuse(players, {
          keys: ['tag', 'pfx'],
          threshold: 0.3,
          includeScore: true,
        })
        return fuseIndex
      })
  }

  return loadPromise
}

export async function searchPlayers(
  query: string,
  limit = 10,
): Promise<PlayerRecord[]> {
  const index = await loadIndex()
  return index.search(query, { limit }).map((r) => r.item)
}

export async function preloadIndex(): Promise<void> {
  await loadIndex()
}
