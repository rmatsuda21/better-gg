import type { BracketData } from './bracket-utils'

// --- Per-PG bracket formatting (used by BracketVisualization) ---

const NAMED_ROUND_MAP: Record<string, string> = {
  'Grand Final Reset': 'True Final',
  'Grand Final': 'GF',
  'Winners Final': 'WF',
  'Winners Semi-Final': 'WSF',
  'Winners Quarter-Final': 'WQF',
  'Losers Final': 'LF',
  'Losers Semi-Final': 'LSF',
  'Losers Quarter-Final': 'LQF',
}

const WINNERS_RE = /^Winners Round (\d+)$/
const LOSERS_RE = /^Losers Round (\d+)$/

/**
 * Format a round label using the compact "Top N" convention.
 * Used by BracketVisualization for per-phase-group bracket display.
 *
 * Named rounds (GF, WF, WSF, etc.) map directly. Numbered rounds use the
 * bracket size to compute "Top N": how many entrants are still alive at that
 * round.
 *
 * - Winners Round X: N = bracketSize / 2^(X-1)
 * - Losers Round X: N = bracketSize / 2^ceil(X/2)
 *   (consecutive pairs share the same Top N since losers rounds alternate
 *    reduction and feed-in)
 */
export function formatRoundLabel(fullRoundText: string, bracketSize?: number): string {
  const named = NAMED_ROUND_MAP[fullRoundText]
  if (named) return named

  const winnersMatch = WINNERS_RE.exec(fullRoundText)
  if (winnersMatch) {
    const x = parseInt(winnersMatch[1], 10)
    if (bracketSize != null) {
      const n = Math.round(bracketSize / Math.pow(2, x - 1))
      return `W. T${n}`
    }
    return `WR${x}`
  }

  const losersMatch = LOSERS_RE.exec(fullRoundText)
  if (losersMatch) {
    const x = parseInt(losersMatch[1], 10)
    if (bracketSize != null) {
      const n = Math.round(bracketSize / Math.pow(2, Math.ceil(x / 2)))
      return `L. T${n}`
    }
    return `LR${x}`
  }

  return fullRoundText
}

/**
 * Compute bracket size from a raw set array by finding the minimum positive
 * round and counting sets at that round: bracketSize = firstRoundSetCount * 2.
 */
export function computeBracketSizeFromSets(
  sets: Array<{ round?: number | null }>,
): number {
  let minRound = Infinity
  for (const set of sets) {
    if (set.round != null && set.round > 0 && set.round < minRound) {
      minRound = set.round
    }
  }
  if (minRound === Infinity) return 0

  let count = 0
  for (const set of sets) {
    if (set.round === minRound) count++
  }
  return count * 2
}

/**
 * Compute bracket size from pre-built BracketData.
 */
export function computeBracketSize(bracketData: BracketData): number {
  if (bracketData.winnersRounds.length === 0) return 0
  return bracketData.winnersRounds[0].sets.length * 2
}

// --- Event-level round labels (used by SetDetails on player event page) ---

/**
 * Named rounds that always use abbreviations in event-level context.
 * Notably, WQF is NOT here — it gets computed as "W. T{N}" on the set list
 * to show the event-level position (e.g., "W. T16" not "WQF").
 */
const EVENT_ABBREVIATIONS: Record<string, string> = {
  'Grand Final Reset': 'True Final',
  'Grand Final': 'GF',
  'Winners Final': 'WF',
  'Winners Semi-Final': 'WSF',
  'Losers Final': 'LF',
  'Losers Semi-Final': 'LSF',
  'Losers Quarter-Final': 'LQF',
}

function nextPowerOf2(n: number): number {
  if (n <= 0) return 1
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Compute event-level round labels for a player's set list.
 *
 * Uses event numEntrants to produce "Top N" labels that reflect how many
 * entrants remain at each stage of the event — not the per-phase-group
 * bracket size.
 *
 * Approach: collect all user's winners-side sets across phases, sort by
 * phase order then round number, and assign labels sequentially.
 * The K-th winners set (0-indexed) gets N = eventBracketSize / 2^K.
 * This produces a clean halving progression (T256, T128, T64, …) with
 * no duplicates across phases.
 *
 * Named finals (WSF, WF, GF, True Final, LF, LSF, LQF) → abbreviation.
 * Everything else (including WQF) → "W. T{N}" or "L. T{N}".
 */
export function computeEventRoundLabels(
  phaseGroups: Array<{
    phaseOrder: number | null
    bracketSize: number
    sets: Array<{ id?: string | null; round?: number | null; fullRoundText?: string | null; completedAt?: number | null }>
    allSets: Array<{ round?: number | null }>
  }>,
  numEntrants: number,
): Map<string, string> {
  const labels = new Map<string, string>()
  if (numEntrants <= 0 || phaseGroups.length === 0) return labels

  const eventBracketSize = nextPowerOf2(numEntrants)

  // Collect all user sets with their phase context
  const allUserSets: Array<{
    id: string
    round: number
    phaseOrder: number
    fullRoundText: string
    completedAt: number
  }> = []

  for (const pg of phaseGroups) {
    for (const set of pg.sets) {
      if (!set.id) continue
      allUserSets.push({
        id: String(set.id),
        round: set.round ?? 0,
        phaseOrder: pg.phaseOrder ?? 0,
        fullRoundText: set.fullRoundText ?? '',
        completedAt: set.completedAt ?? 0,
      })
    }
  }

  // Label losers / named finals first (these don't depend on order)
  for (const set of allUserSets) {
    const abbrev = EVENT_ABBREVIATIONS[set.fullRoundText]
    if (abbrev) {
      labels.set(set.id, abbrev)
      continue
    }

    if (set.round < 0) {
      const losersMatch = LOSERS_RE.exec(set.fullRoundText)
      if (losersMatch) {
        const x = parseInt(losersMatch[1], 10)
        const n = Math.round(
          eventBracketSize / Math.pow(2, Math.ceil(x / 2)),
        )
        labels.set(set.id, n > 0 ? `L. T${n}` : `LR${x}`)
      } else {
        labels.set(set.id, set.fullRoundText || `LR${Math.abs(set.round)}`)
      }
    }
  }

  // Collect winners-side sets (not yet labeled) and sort by phase order then round
  const winnersSets = allUserSets
    .filter(s => s.round > 0 && !labels.has(s.id))
    .sort((a, b) => {
      if (a.phaseOrder !== b.phaseOrder) return a.phaseOrder - b.phaseOrder
      return a.round - b.round
    })

  // Assign "W. T{N}" labels sequentially — K-th set gets N = eBS / 2^K
  for (let k = 0; k < winnersSets.length; k++) {
    const n = Math.round(eventBracketSize / Math.pow(2, k))
    winnersSets[k].id
    labels.set(winnersSets[k].id, n > 0 ? `W. T${n}` : (winnersSets[k].fullRoundText || `WR${winnersSets[k].round}`))
  }

  return labels
}
