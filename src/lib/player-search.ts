import Fuse from 'fuse.js'
import type { PlayerRecord } from './player-search-types'

let fuseIndex: Fuse<PlayerRecord> | null = null
let rawPlayers: PlayerRecord[] = []
let countries: string[] = []
let loadPromise: Promise<Fuse<PlayerRecord>> | null = null

async function loadIndex(): Promise<Fuse<PlayerRecord>> {
  if (fuseIndex) return fuseIndex

  if (!loadPromise) {
    loadPromise = fetch('/data/players.json')
      .then((res) => res.json())
      .then((players: PlayerRecord[]) => {
        rawPlayers = players
        const countrySet = new Set<string>()
        for (const p of players) {
          if (p.cc) countrySet.add(p.cc)
        }
        countries = [...countrySet].sort()
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
  country?: string,
): Promise<PlayerRecord[]> {
  const index = await loadIndex()
  if (!country) {
    return index.search(query, { limit }).map((r) => r.item)
  }
  // Search with a higher limit then post-filter by country
  const raw = index.search(query, { limit: limit * 20 })
  const filtered: PlayerRecord[] = []
  for (const r of raw) {
    if (r.item.cc === country) {
      filtered.push(r.item)
      if (filtered.length >= limit) break
    }
  }
  return filtered
}

export async function getCountries(): Promise<string[]> {
  await loadIndex()
  return countries
}

export async function preloadIndex(): Promise<void> {
  await loadIndex()
}

export async function getAllPlayers(): Promise<PlayerRecord[]> {
  await loadIndex()
  return rawPlayers
}

export async function searchPlayersAll(
  query: string,
  limit = 1000,
): Promise<PlayerRecord[]> {
  const index = await loadIndex()
  return index.search(query, { limit }).map((r) => r.item)
}
