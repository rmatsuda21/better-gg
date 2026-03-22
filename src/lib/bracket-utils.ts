import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import type { SiblingPhaseInfo } from '../hooks/use-phase-bracket'

export interface BracketEntrant {
  id: string | null
  name: string
  seedNum: number | null
  isProjected: boolean
}

export interface SlotPrereq {
  prereqId: string | null
  prereqPlacement: number | null // 1 = winner, 2 = loser
  prereqType: string | null // "set" or "bye"
}

export interface SetClickEntrant {
  id: string | null
  name: string
  playerId: string | null
  seedNum: number | null
}

export interface SetClickInfo {
  setId: string
  fullRoundText: string | null
  winnerId: string | null
  scores: [string | null, string | null]
  isDQ: boolean
  entrants: [SetClickEntrant | null, SetClickEntrant | null]
}

export interface BracketSet {
  id: string
  round: number
  index: number
  fullRoundText: string | null
  entrants: [BracketEntrant | null, BracketEntrant | null]
  prereqs: [SlotPrereq | null, SlotPrereq | null]
  winnerId: string | null
  isUserSet: boolean
  scores: [string | null, string | null]
  isDQ: boolean
}

export interface BracketRound {
  round: number
  label: string | null
  sets: BracketSet[]
}

export interface BracketData {
  winnersRounds: BracketRound[]
  losersRounds: BracketRound[]
}

export interface ProjectedSet {
  entrants: [BracketEntrant | null, BracketEntrant | null]
  winnerId: string | null
}

function parsePreviewSetId(id: string): { pgId: string; round: number; index: number } | null {
  const parts = id.split('_')
  if (parts.length < 4 || parts[0] !== 'preview') return null
  const round = parseInt(parts[parts.length - 2], 10)
  const index = parseInt(parts[parts.length - 1], 10)
  if (isNaN(round) || isNaN(index)) return null
  return { pgId: parts[1], round, index }
}

type SetNode = PhaseGroupInfo['allSets'][number]
type SlotNode = NonNullable<NonNullable<SetNode['slots']>[number]>

function resolveEntrant(slot: SlotNode | null | undefined) {
  return slot?.entrant ?? slot?.seed?.entrant
}

function resolveEntrantInfo(
  slot: SlotNode | null | undefined,
  seedEntrantOverrides?: Map<number, BracketEntrant>,
  seedIdToSeedNum?: Map<string, number>,
  suppressEntrants?: boolean,
): BracketEntrant | null {
  if (suppressEntrants) return null
  // Try slot.seed.seedNum first (works for CREATED phases with direct seed assignments)
  let seedNum = slot?.seed?.seedNum
  // Fallback: for progression-receiving CREATED phases, slot.seed is null but
  // prereqId references the seed ID — map it to seedNum via the lookup table
  if (seedNum == null && slot?.prereqType === 'seed' && slot?.prereqId && seedIdToSeedNum) {
    seedNum = seedIdToSeedNum.get(String(slot.prereqId))
  }
  if (seedNum != null && seedEntrantOverrides?.has(seedNum)) {
    return seedEntrantOverrides.get(seedNum)!
  }
  const ent = resolveEntrant(slot)
  if (!ent?.id) return null
  return {
    id: String(ent.id),
    name: ent.name ?? 'Unknown',
    seedNum: slot?.seed?.seedNum ?? ent.initialSeedNum ?? null,
    isProjected: false,
  }
}

function extractPrereq(slot: SlotNode | null | undefined): SlotPrereq | null {
  if (!slot?.prereqId) return null
  return {
    prereqId: slot.prereqId,
    prereqPlacement: slot.prereqPlacement ?? null,
    prereqType: slot.prereqType ?? null,
  }
}

function parseSlotScores(displayScore: string | null | undefined): { scores: [string | null, string | null]; isDQ: boolean } {
  if (!displayScore) return { scores: [null, null], isDQ: false }
  if (displayScore === 'DQ') return { scores: [null, null], isDQ: true }

  const halves = displayScore.split(' - ')
  if (halves.length !== 2) return { scores: [null, null], isDQ: false }

  const score0 = halves[0].trim().split(/\s+/).pop() ?? null
  const score1 = halves[1].trim().split(/\s+/).pop() ?? null
  return { scores: [score0, score1], isDQ: score0 === 'DQ' || score1 === 'DQ' }
}

export function buildBracketData(
  phaseGroup: PhaseGroupInfo,
  userEntrantId?: string,
  seedEntrantOverrides?: Map<number, BracketEntrant>,
  seedIdToSeedNum?: Map<string, number>,
  suppressEntrants?: boolean,
): BracketData {
  const allSets = phaseGroup.allSets
  const parsedSets: Array<{ set: SetNode; round: number; index: number }> = []
  const unparsedSets: Array<{ set: SetNode; signedRound: number }> = []

  for (const set of allSets) {
    const parsed = parsePreviewSetId(String(set.id ?? ''))
    if (parsed) {
      parsedSets.push({ set, round: parsed.round, index: parsed.index })
    } else if (set.round != null) {
      unparsedSets.push({ set, signedRound: set.round })
    }
  }

  // For non-preview sets (ACTIVE/COMPLETED events), group by signed round
  // and assign sequential indices within each round
  if (parsedSets.length === 0 && unparsedSets.length > 0) {
    const byRound = new Map<number, SetNode[]>()
    for (const { set, signedRound } of unparsedSets) {
      if (!byRound.has(signedRound)) byRound.set(signedRound, [])
      byRound.get(signedRound)!.push(set)
    }
    for (const [signedRound, sets] of byRound) {
      sets.sort((a, b) => Number(a.id) - Number(b.id))
      sets.forEach((set, index) => {
        parsedSets.push({ set, round: Math.abs(signedRound), index })
      })
    }
  }

  const winnersMap = new Map<number, Array<{ set: SetNode; index: number }>>()
  const losersMap = new Map<number, Array<{ set: SetNode; index: number }>>()

  for (const { set, round, index } of parsedSets) {
    const r = set.round ?? round
    const map = r >= 0 ? winnersMap : losersMap
    const absR = Math.abs(r)
    if (!map.has(absR)) map.set(absR, [])
    map.get(absR)!.push({ set, index })
  }

  function buildRounds(map: Map<number, Array<{ set: SetNode; index: number }>>): BracketRound[] {
    const rounds: BracketRound[] = []
    const sortedKeys = [...map.keys()].sort((a, b) => a - b)

    for (const roundNum of sortedKeys) {
      const entries = map.get(roundNum)!
      entries.sort((a, b) => a.index - b.index)

      const sets: BracketSet[] = entries.map(({ set, index }) => {
        const e0 = resolveEntrantInfo(set.slots?.[0], seedEntrantOverrides, seedIdToSeedNum, suppressEntrants)
        const e1 = resolveEntrantInfo(set.slots?.[1], seedEntrantOverrides, seedIdToSeedNum, suppressEntrants)
        const p0 = extractPrereq(set.slots?.[0])
        const p1 = extractPrereq(set.slots?.[1])
        const involvesUser = userEntrantId != null && (e0?.id === userEntrantId || e1?.id === userEntrantId)
        const { scores, isDQ } = parseSlotScores(set.displayScore)

        return {
          id: String(set.id!),
          round: roundNum,
          index,
          fullRoundText: set.fullRoundText ?? null,
          entrants: [e0, e1],
          prereqs: [p0, p1],
          winnerId: set.winnerId != null ? String(set.winnerId) : null,
          isUserSet: involvesUser,
          scores,
          isDQ,
        }
      })

      // Group sets by fullRoundText to split GF / GF Reset into separate columns
      const byLabel = new Map<string, BracketSet[]>()
      for (const s of sets) {
        const key = s.fullRoundText ?? ''
        if (!byLabel.has(key)) byLabel.set(key, [])
        byLabel.get(key)!.push(s)
      }
      for (const [, group] of byLabel) {
        const label = group[0]?.fullRoundText ?? null
        rounds.push({ round: roundNum, label, sets: group })
      }
    }

    return rounds
  }

  return {
    winnersRounds: buildRounds(winnersMap),
    losersRounds: buildRounds(losersMap),
  }
}

function pickHigherSeed(a: BracketEntrant, b: BracketEntrant): BracketEntrant {
  const aSeed = a.seedNum ?? Infinity
  const bSeed = b.seedNum ?? Infinity
  return aSeed <= bSeed ? a : b
}

export function getWinnerFromProjected(ps: ProjectedSet): BracketEntrant | null {
  if (!ps.winnerId) return null
  return ps.entrants[0]?.id === ps.winnerId ? ps.entrants[0] : ps.entrants[1]
}

export function getLoserFromProjected(ps: ProjectedSet): BracketEntrant | null {
  if (!ps.winnerId) return null
  return ps.entrants[0]?.id === ps.winnerId ? ps.entrants[1] : ps.entrants[0]
}

/**
 * Resolve what entrant a prereq chain produces.
 *
 * For hidden bye rounds (not in our data), traces the chain through the bye
 * tree structure. In a DE bracket with byes, hidden losers rounds form a binary
 * bye tree where the non-bye branch carries a WR1 loser down to the visible LR1.
 *
 * The trace pattern: hidden set at round R, index I has its non-bye slot
 * pointing to round R+1 (closer to 0), index 2I+1 (the odd child in the tree).
 * This continues until hitting a WR1 set (positive round) which IS in our data.
 */
function resolvePrereq(
  prereq: SlotPrereq,
  projected: Map<string, ProjectedSet>,
  minWinnersRound: number,
): BracketEntrant | null {
  const { prereqPlacement } = prereq
  const prereqId = prereq.prereqId ? String(prereq.prereqId) : null
  if (!prereqId) return null

  // Check if the prereq set is in our projected results
  const ps = projected.get(prereqId)
  if (ps) {
    const result = prereqPlacement === 2
      ? getLoserFromProjected(ps)
      : getWinnerFromProjected(ps)
    return result ? { ...result, isProjected: true } : null
  }

  // Hidden bye round — trace through the bye tree to find the source WR set.
  //
  // The hidden bye tree structure (from API data):
  //   round-3[i] non-bye slot → round-2[2i+1] (P1=winner)
  //   round-2[j] (j odd) slot0 → WR1[j] (P2=loser)
  //   round-2[j] (j even) → full bye (no real entrant)
  //
  // General pattern: each hidden round halves the set count by pairing adjacent
  // sets. The non-bye slot points to the child at index 2i+1 in the next-inner
  // hidden round. The innermost hidden round (-2) directly references WR1 sets.
  //
  // We trace by: index → 2*index+1 for each hidden level, until we reach a
  // round that references a WR1 set (positive round) which IS in our data.
  const parsed = parsePreviewSetId(String(prereqId))
  if (!parsed) return null

  let currentIndex = parsed.index

  // Each level maps index → 2*index + 1 until we reach round -2
  const hiddenLevels = Math.abs(parsed.round) - 2 // number of hops to reach round -2
  for (let i = 0; i < hiddenLevels; i++) {
    currentIndex = currentIndex * 2 + 1
  }

  // Now currentIndex points to round-2[currentIndex], which references WR1[currentIndex] loser.
  // The first winners round may not be round 1 (e.g., round 2 for progression-receiving phases).
  const wrSetId = `preview_${parsed.pgId}_${minWinnersRound}_${currentIndex}`
  const wrPs = projected.get(wrSetId)
  if (wrPs) {
    const loser = getLoserFromProjected(wrPs)
    return loser ? { ...loser, isProjected: true } : null
  }

  return null
}

export interface BracketEntrantInfo {
  entrantId: string
  name: string
  seedNum: number | null
  prefix: string | null
  phaseGroupId: string
  poolLabel: string | null
}

export function extractBracketEntrants(phaseGroups: PhaseGroupInfo[]): BracketEntrantInfo[] {
  const seen = new Map<string, BracketEntrantInfo>()

  for (const pg of phaseGroups) {
    for (const set of pg.allSets) {
      for (const slot of set.slots ?? []) {
        const entrant = slot?.entrant ?? slot?.seed?.entrant
        if (!entrant?.id) continue
        const id = String(entrant.id)
        if (seen.has(id)) continue

        seen.set(id, {
          entrantId: id,
          name: entrant.name ?? 'Unknown',
          seedNum: slot?.seed?.seedNum ?? entrant.initialSeedNum ?? null,
          prefix: entrant.participants?.[0]?.prefix ?? null,
          phaseGroupId: pg.phaseGroupId,
          poolLabel: pg.displayIdentifier,
        })
      }
    }
  }

  return [...seen.values()].sort((a, b) => (a.seedNum ?? Infinity) - (b.seedNum ?? Infinity))
}

/**
 * Generate projected bracket results assuming the higher (lower number) seed always wins.
 * Uses prereq data from the API to follow exact feeder chains.
 *
 * Uses a convergence loop because DE bracket dependencies are cross-sided:
 * Grand Finals depends on Losers Final, but both are in different bracket sides.
 * A single pass with winners-first ordering can't resolve GF/GFR.
 */
export function buildProjectedResults(
  data: BracketData,
): Map<string, ProjectedSet> {
  const projected = new Map<string, ProjectedSet>()

  const minWinnersRound = data.winnersRounds.length > 0
    ? Math.min(...data.winnersRounds.map(r => r.round))
    : 1

  // Process all rounds in dependency order:
  // Winners first (ascending round), then losers (ascending round number)
  const allRounds = [
    ...data.winnersRounds.map(r => ({ ...r, side: 'w' as const })),
    ...data.losersRounds.map(r => ({ ...r, side: 'l' as const })),
  ]

  allRounds.sort((a, b) => {
    if (a.side !== b.side) return a.side === 'w' ? -1 : 1
    return a.round - b.round
  })

  // Convergence loop: GF/GFR (winners side) depend on Losers Final,
  // so a single pass can't resolve everything. Iterate until stable.
  let changed = true
  let passes = 0
  while (changed && passes < 3) {
    changed = false
    passes++

    for (const round of allRounds) {
      for (const set of round.sets) {
        const existing = projected.get(set.id)

        let e0 = set.entrants[0] ?? existing?.entrants[0] ?? null
        let e1 = set.entrants[1] ?? existing?.entrants[1] ?? null

        // Resolve empty slots from prereqs
        if (!e0 && set.prereqs[0]) {
          e0 = resolvePrereq(set.prereqs[0], projected, minWinnersRound)
        }
        if (!e1 && set.prereqs[1]) {
          e1 = resolvePrereq(set.prereqs[1], projected, minWinnersRound)
        }

        // Determine projected winner
        let winnerId: string | null = set.winnerId
        if (!winnerId && e0 && e1) {
          winnerId = pickHigherSeed(e0, e1).id
        } else if (!winnerId && (e0 || e1)) {
          winnerId = (e0 ?? e1)!.id
        }

        // Check if anything changed from the existing projected result
        if (!existing ||
            existing.winnerId !== winnerId ||
            existing.entrants[0] !== e0 ||
            existing.entrants[1] !== e1) {
          projected.set(set.id, { entrants: [e0, e1], winnerId })
          changed = true
        }
      }
    }
  }

  return projected
}

export interface ProjectedStanding {
  entrant: BracketEntrant
  placement: number
}

/**
 * Compute projected standings from bracket results.
 * For DE brackets: GF winner = 1st, GF loser = 2nd, LF loser = 3rd/4th, etc.
 * For single elim: final winner = 1st, final loser = 2nd, semifinal losers = 3rd, etc.
 */
export function computeProjectedStandings(
  data: BracketData,
  projectedResults: Map<string, ProjectedSet>,
): ProjectedStanding[] {
  const standings: ProjectedStanding[] = []
  const placed = new Set<string>()

  // Process winners rounds in reverse (finals first)
  const wRounds = [...data.winnersRounds].reverse()
  const lRounds = [...data.losersRounds].reverse()

  // Grand Finals / Finals winner = 1st place
  if (wRounds.length > 0) {
    const finalRound = wRounds[0]
    for (const set of finalRound.sets) {
      const ps = projectedResults.get(set.id)
      if (!ps) continue
      const winner = getWinnerFromProjected(ps)
      const loser = getLoserFromProjected(ps)
      if (winner?.id && !placed.has(winner.id)) {
        standings.push({ entrant: winner, placement: 1 })
        placed.add(winner.id)
      }
      if (loser?.id && !placed.has(loser.id)) {
        standings.push({ entrant: loser, placement: 2 })
        placed.add(loser.id)
      }
    }
  }

  // Losers finals losers = 3rd/4th, etc.
  let placement = standings.length + 1
  for (const round of lRounds) {
    const roundLosers: BracketEntrant[] = []
    for (const set of round.sets) {
      const ps = projectedResults.get(set.id)
      if (!ps) continue
      const loser = getLoserFromProjected(ps)
      if (loser?.id && !placed.has(loser.id)) {
        roundLosers.push(loser)
        placed.add(loser.id)
      }
    }
    if (roundLosers.length > 0) {
      for (const ent of roundLosers) {
        standings.push({ entrant: ent, placement })
      }
      placement += roundLosers.length
    }
  }

  // Winners bracket losers (who didn't appear in losers bracket)
  for (const round of wRounds) {
    const roundLosers: BracketEntrant[] = []
    for (const set of round.sets) {
      const ps = projectedResults.get(set.id)
      if (!ps) continue
      const loser = getLoserFromProjected(ps)
      if (loser?.id && !placed.has(loser.id)) {
        roundLosers.push(loser)
        placed.add(loser.id)
      }
    }
    if (roundLosers.length > 0) {
      for (const ent of roundLosers) {
        standings.push({ entrant: ent, placement })
      }
      placement += roundLosers.length
    }
  }

  return standings
}

export interface PhaseNavInfo {
  prevPhase: { id: string; name: string } | null
  nextPhase: { id: string; name: string } | null
}

export function computePhaseNav(
  siblingPhases: SiblingPhaseInfo[],
  currentPhaseOrder: number | null,
  originPhaseIds?: string[],
): PhaseNavInfo {
  // Use originPhaseIds for prevPhase when available
  let prevPhase: { id: string; name: string } | null = null
  if (originPhaseIds && originPhaseIds.length > 0) {
    const origin = siblingPhases.find(p => originPhaseIds.includes(p.id))
    if (origin) prevPhase = { id: origin.id, name: origin.name }
  }

  if (currentPhaseOrder == null || siblingPhases.length <= 1) {
    return { prevPhase, nextPhase: null }
  }

  const sorted = [...siblingPhases].sort((a, b) => a.phaseOrder - b.phaseOrder)
  const idx = sorted.findIndex(p => p.phaseOrder === currentPhaseOrder)
  if (idx === -1) return { prevPhase, nextPhase: null }

  // Fall back to phaseOrder-based prev if originPhaseIds didn't resolve
  if (!prevPhase) {
    const prev = idx > 0 ? sorted[idx - 1] : null
    prevPhase = prev ? { id: prev.id, name: prev.name } : null
  }

  const next = idx < sorted.length - 1 ? sorted[idx + 1] : null
  return {
    prevPhase,
    nextPhase: next ? { id: next.id, name: next.name } : null,
  }
}
