import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'

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

export interface BracketSet {
  id: string
  round: number
  index: number
  fullRoundText: string | null
  entrants: [BracketEntrant | null, BracketEntrant | null]
  prereqs: [SlotPrereq | null, SlotPrereq | null]
  winnerId: string | null
  isUserSet: boolean
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

function resolveEntrantInfo(slot: SlotNode | null | undefined): BracketEntrant | null {
  const ent = resolveEntrant(slot)
  if (!ent?.id) return null
  return {
    id: ent.id,
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

export function buildBracketData(
  phaseGroup: PhaseGroupInfo,
  userEntrantId?: string,
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
        const e0 = resolveEntrantInfo(set.slots?.[0])
        const e1 = resolveEntrantInfo(set.slots?.[1])
        const p0 = extractPrereq(set.slots?.[0])
        const p1 = extractPrereq(set.slots?.[1])
        const involvesUser = e0?.id === userEntrantId || e1?.id === userEntrantId

        return {
          id: String(set.id!),
          round: roundNum,
          index,
          fullRoundText: set.fullRoundText ?? null,
          entrants: [e0, e1],
          prereqs: [p0, p1],
          winnerId: set.winnerId != null ? String(set.winnerId) : null,
          isUserSet: involvesUser,
        }
      })

      const label = sets[0]?.fullRoundText ?? null
      rounds.push({ round: roundNum, label, sets })
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

function getWinnerFromProjected(ps: ProjectedSet): BracketEntrant | null {
  if (!ps.winnerId) return null
  return ps.entrants[0]?.id === ps.winnerId ? ps.entrants[0] : ps.entrants[1]
}

function getLoserFromProjected(ps: ProjectedSet): BracketEntrant | null {
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
  // round that references a WR1 set (positive round) in its prereq.
  const parsed = parsePreviewSetId(String(prereqId))
  if (!parsed) return null

  let currentIndex = parsed.index

  // Trace through hidden rounds: round-3 → round-2 → WR1
  // From round-3[i], non-bye child is round-2[2i+1]
  // From round-2[j], if j is odd, it holds WR1[j] loser
  // The number of hidden levels = abs(first visible losers round) - abs(WR1 round) - 1
  // For this bracket: hidden rounds -3, -2, -1 (3 levels)
  // But only -3 and -2 have real data; -1 is all byes.

  // Each level maps index → 2*index + 1 until we reach round -2
  const hiddenLevels = Math.abs(parsed.round) - 2 // number of hops to reach round -2
  for (let i = 0; i < hiddenLevels; i++) {
    currentIndex = currentIndex * 2 + 1
  }

  // Now currentIndex points to round-2[currentIndex], which references WR1[currentIndex] loser
  const wrSetId = `preview_${parsed.pgId}_1_${currentIndex}`
  const wrPs = projected.get(wrSetId)
  if (wrPs) {
    const loser = getLoserFromProjected(wrPs)
    return loser ? { ...loser, isProjected: true } : null
  }

  return null
}

/**
 * Generate projected bracket results assuming the higher (lower number) seed always wins.
 * Uses prereq data from the API to follow exact feeder chains.
 */
export function buildProjectedResults(
  data: BracketData,
): Map<string, ProjectedSet> {
  const projected = new Map<string, ProjectedSet>()

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

  for (const round of allRounds) {
    for (const set of round.sets) {
      let e0 = set.entrants[0]
      let e1 = set.entrants[1]

      // Resolve empty slots from prereqs
      if (!e0 && set.prereqs[0]) {
        e0 = resolvePrereq(set.prereqs[0], projected)
      }
      if (!e1 && set.prereqs[1]) {
        e1 = resolvePrereq(set.prereqs[1], projected)
      }

      // Determine projected winner
      let winnerId: string | null = set.winnerId
      if (!winnerId && e0 && e1) {
        winnerId = pickHigherSeed(e0, e1).id
      } else if (!winnerId && (e0 || e1)) {
        winnerId = (e0 ?? e1)!.id
      }

      projected.set(set.id, { entrants: [e0, e1], winnerId })
    }
  }

  return projected
}
