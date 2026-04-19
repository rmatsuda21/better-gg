interface SetNode {
  winnerId?: number | null
  event?: {
    id?: string | null
    videogame?: { id?: string | null } | null
  } | null
  slots?: Array<{
    entrant?: {
      id?: string | null
      participants?: Array<{
        player?: { id?: string | null } | null
      } | null> | null
    } | null
  } | null> | null
  games?: Array<{
    selections?: Array<{
      entrant?: { id?: string | null } | null
      selectionType?: string | null
      selectionValue?: number | null
    } | null> | null
  } | null> | null
}

interface StandingNode {
  placement?: number | null
  container?: {
    __typename?: string
    name?: string | null
    numEntrants?: number | null
  } | null
}

export interface WinRate {
  wins: number
  losses: number
  rate: number
}

export interface CharacterUsage {
  characterId: number
  count: number
  percentage: number
}

export interface HeadToHead {
  wins: number
  losses: number
}

export function computeWinRate(sets: SetNode[], playerId: string): WinRate {
  let wins = 0
  let losses = 0

  for (const set of sets) {
    if (set.winnerId == null) continue
    const playerEntrant = set.slots?.find((slot) =>
      slot?.entrant?.participants?.some(
        (p) => p?.player?.id != null && String(p.player.id) === playerId,
      ),
    )
    if (!playerEntrant?.entrant?.id) continue

    if (set.winnerId === Number(playerEntrant.entrant.id)) {
      wins++
    } else {
      losses++
    }
  }

  const total = wins + losses
  return { wins, losses, rate: total > 0 ? wins / total : 0 }
}

export function computeAverageSeed(standings: StandingNode[]): number {
  const placements = standings
    .map((s) => s.placement)
    .filter((p): p is number => p != null)
  if (placements.length === 0) return 0
  return placements.reduce((a, b) => a + b, 0) / placements.length
}

export function computeCharacterUsage(
  sets: SetNode[],
  playerId: string,
): CharacterUsage[] {
  const counts = new Map<number, number>()
  let total = 0

  for (const set of sets) {
    const playerEntrant = set.slots?.find((slot) =>
      slot?.entrant?.participants?.some(
        (p) => p?.player?.id != null && String(p.player.id) === playerId,
      ),
    )
    if (!playerEntrant?.entrant?.id) continue

    for (const game of set.games ?? []) {
      for (const sel of game?.selections ?? []) {
        if (
          sel?.selectionType === 'CHARACTER' &&
          sel.selectionValue != null &&
          sel.entrant?.id === playerEntrant.entrant.id
        ) {
          counts.set(
            sel.selectionValue,
            (counts.get(sel.selectionValue) ?? 0) + 1,
          )
          total++
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([characterId, count]) => ({
      characterId,
      count,
      percentage: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export function computeHeadToHead(
  sets: SetNode[],
  myEntrantId: string,
  opponentEntrantId: string,
): HeadToHead {
  let wins = 0
  let losses = 0

  for (const set of sets) {
    if (set.winnerId == null) continue
    const hasMe = set.slots?.some(
      (s) => s?.entrant?.id === myEntrantId,
    )
    const hasOpponent = set.slots?.some(
      (s) => s?.entrant?.id === opponentEntrantId,
    )
    if (!hasMe || !hasOpponent) continue

    if (set.winnerId === Number(myEntrantId)) {
      wins++
    } else {
      losses++
    }
  }

  return { wins, losses }
}

export function deRoundsFromWinning(seed: number): number {
  if (seed <= 1) return 0
  if (seed <= 4) return seed - 1
  const k = Math.ceil(Math.log2(seed)) - 2
  return seed <= 3 * Math.pow(2, k) ? 2 * k + 2 : 2 * k + 3
}

export function computePerEventCharacters(
  sets: SetNode[],
  playerId: string,
  videogameId?: string,
): Map<string, number[]> {
  const eventCharCounts = new Map<string, Map<number, number>>()

  for (const set of sets) {
    if (
      videogameId &&
      set.event?.videogame?.id != null &&
      String(set.event.videogame.id) !== videogameId
    )
      continue

    const eventId = set.event?.id
    if (!eventId) continue

    const playerEntrant = set.slots?.find((slot) =>
      slot?.entrant?.participants?.some(
        (p) => p?.player?.id != null && String(p.player.id) === playerId,
      ),
    )
    if (!playerEntrant?.entrant?.id) continue

    for (const game of set.games ?? []) {
      for (const sel of game?.selections ?? []) {
        if (
          sel?.selectionType === 'CHARACTER' &&
          sel.selectionValue != null &&
          sel.entrant?.id === playerEntrant.entrant.id
        ) {
          if (!eventCharCounts.has(eventId)) {
            eventCharCounts.set(eventId, new Map())
          }
          const counts = eventCharCounts.get(eventId)!
          counts.set(sel.selectionValue, (counts.get(sel.selectionValue) ?? 0) + 1)
        }
      }
    }
  }

  const result = new Map<string, number[]>()
  for (const [eventId, counts] of eventCharCounts) {
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)
    result.set(eventId, sorted)
  }
  return result
}

export function computeUpsetFactor(
  winnerSeed: number,
  loserSeed: number,
): number | null {
  if (winnerSeed <= loserSeed) return null
  const uf = deRoundsFromWinning(winnerSeed) - deRoundsFromWinning(loserSeed)
  return uf > 0 ? uf : null
}
