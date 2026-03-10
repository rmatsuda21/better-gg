import { Fragment, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { PhaseGroupInfo } from '../../hooks/use-entrant-sets'
import {
  buildBracketData,
  buildProjectedResults,
} from '../../lib/bracket-utils'
import type { BracketRound, BracketSet, BracketEntrant, ProjectedSet } from '../../lib/bracket-utils'
import styles from './BracketVisualization.module.css'

interface BracketVisualizationProps {
  phaseGroup: PhaseGroupInfo
  userEntrantId?: string
  showProjectionToggle?: boolean
}

function buildEntrantPlayerMap(phaseGroup: PhaseGroupInfo): Map<string, string> {
  const map = new Map<string, string>()
  for (const set of phaseGroup.allSets) {
    for (const slot of set.slots ?? []) {
      const entrant = slot?.entrant ?? slot?.seed?.entrant
      if (entrant?.id) {
        const playerId = entrant.participants?.[0]?.player?.id
        if (playerId) map.set(String(entrant.id), String(playerId))
      }
    }
  }
  return map
}

export function BracketVisualization({
  phaseGroup,
  userEntrantId,
  showProjectionToggle = true,
}: BracketVisualizationProps) {
  const [showProjected, setShowProjected] = useState(false)
  const bracketData = buildBracketData(phaseGroup, userEntrantId)
  const projectedResults = showProjected
    ? buildProjectedResults(bracketData)
    : null
  const entrantPlayerMap = buildEntrantPlayerMap(phaseGroup)

  return (
    <div className={styles.wrapper}>
      {showProjectionToggle && (
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${!showProjected ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowProjected(false)}
          >
            Actual
          </button>
          <button
            className={`${styles.toggleBtn} ${showProjected ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowProjected(true)}
          >
            Projected
          </button>
        </div>
      )}

      {bracketData.winnersRounds.length > 0 && (
        <>
          {bracketData.losersRounds.length > 0 && (
            <div className={styles.sectionLabel}>Winners Bracket</div>
          )}
          <BracketSection
            rounds={bracketData.winnersRounds}
            userEntrantId={userEntrantId}
            projectedResults={projectedResults}
            entrantPlayerMap={entrantPlayerMap}
          />
        </>
      )}

      {bracketData.losersRounds.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Losers Bracket</div>
          <BracketSection
            rounds={bracketData.losersRounds}
            userEntrantId={userEntrantId}
            projectedResults={projectedResults}
            entrantPlayerMap={entrantPlayerMap}
          />
        </>
      )}
    </div>
  )
}

interface TreePosition {
  start: number
  end: number
}

function computeTreePositions(
  rounds: BracketRound[],
): { positions: Map<string, TreePosition>; totalLeaves: number } {
  const positions = new Map<string, TreePosition>()
  if (rounds.length === 0) return { positions, totalLeaves: 1 }

  // Build setById map across all rounds in this section
  const setById = new Map<string, BracketSet>()
  const setRoundIndex = new Map<string, number>() // set id -> round index in `rounds`
  for (let ri = 0; ri < rounds.length; ri++) {
    for (const s of rounds[ri].sets) {
      setById.set(s.id, s)
      setRoundIndex.set(s.id, ri)
    }
  }

  // Build feedsInto: prereqId -> downstream set id
  const feedsInto = new Map<string, string>()
  for (const s of setById.values()) {
    for (const prereq of s.prereqs) {
      if (prereq?.prereqId && prereq.prereqType === 'set') {
        const pid = String(prereq.prereqId)
        if (setById.has(pid)) {
          feedsInto.set(pid, s.id)
        }
      }
    }
  }

  // Find root sets (not feeding into any other set in this section)
  const rootSets = [...setById.values()].filter(s => !feedsInto.has(s.id))

  // Compute leaf count per set (memoized)
  const leafCounts = new Map<string, number>()

  function getLeafCount(setId: string): number {
    if (leafCounts.has(setId)) return leafCounts.get(setId)!
    const s = setById.get(setId)
    if (!s) { leafCounts.set(setId, 1); return 1 }

    let total = 0
    let hasLocalFeeder = false
    const seen = new Set<string>()
    for (const prereq of s.prereqs) {
      if (prereq?.prereqId && prereq.prereqType === 'set') {
        const pid = String(prereq.prereqId)
        if (setById.has(pid) && !seen.has(pid)) {
          seen.add(pid)
          total += getLeafCount(pid)
          hasLocalFeeder = true
        }
      }
    }

    if (!hasLocalFeeder) total = 1
    leafCounts.set(setId, total)
    return total
  }

  // Compute total leaves from roots
  let totalLeaves = 0
  for (const root of rootSets) {
    totalLeaves += getLeafCount(root.id)
  }
  if (totalLeaves === 0) totalLeaves = 1

  // Sort roots by their index within their round for consistent ordering
  rootSets.sort((a, b) => a.index - b.index)

  // DFS assign row ranges
  function assignPositions(setId: string, start: number, end: number) {
    positions.set(setId, { start, end })
    const s = setById.get(setId)
    if (!s) return

    // Collect local feeders in slot order (deduplicated by set ID)
    const feeders: Array<{ id: string }> = []
    const seenFeeders = new Set<string>()

    for (const prereq of s.prereqs) {
      if (prereq?.prereqId && prereq.prereqType === 'set') {
        const pid = String(prereq.prereqId)
        if (setById.has(pid) && !seenFeeders.has(pid)) {
          seenFeeders.add(pid)
          feeders.push({ id: pid })
        }
      }
    }

    if (feeders.length === 0) return

    // Distribute full span among real feeders proportional to leaf counts
    const totalSpan = end - start
    const totalFeederLeaves = feeders.reduce((sum, f) => sum + getLeafCount(f.id), 0)
    let cursor = start
    for (const feeder of feeders) {
      const feederSpan = (getLeafCount(feeder.id) / totalFeederLeaves) * totalSpan
      assignPositions(feeder.id, cursor, cursor + feederSpan)
      cursor += feederSpan
    }
  }

  // Assign from roots
  let rootCursor = 0
  for (const root of rootSets) {
    const lc = getLeafCount(root.id)
    assignPositions(root.id, rootCursor, rootCursor + lc)
    rootCursor += lc
  }

  // Any sets not reached (disconnected) get uniform fallback
  for (const round of rounds) {
    const unreached = round.sets.filter(s => !positions.has(s.id))
    if (unreached.length > 0) {
      const span = totalLeaves / unreached.length
      unreached.forEach((s, i) => {
        positions.set(s.id, { start: i * span, end: (i + 1) * span })
      })
    }
  }

  return { positions, totalLeaves }
}

function BracketSection({
  rounds,
  userEntrantId,
  projectedResults,
  entrantPlayerMap,
}: {
  rounds: BracketRound[]
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
}) {
  if (rounds.length === 0) return null

  const { positions, totalLeaves } = computeTreePositions(rounds)

  // Grid columns: for each round a set column + connector column (except last)
  const colTemplate = rounds
    .map((_, i) =>
      i < rounds.length - 1 ? 'minmax(200px, 1fr) 24px' : 'minmax(200px, 1fr)'
    )
    .join(' ')

  // Build a set of set IDs per round for quick lookup in connector logic
  const roundSetIds: Set<string>[] = rounds.map(
    r => new Set(r.sets.map(s => s.id)),
  )

  return (
    <div className={styles.scrollContainer}>
      <div
        className={styles.bracket}
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `auto repeat(${totalLeaves}, 1fr)`,
        }}
      >
        {rounds.map((round, roundIdx) => {
          const col = roundIdx * 2 + 1
          const isLast = roundIdx === rounds.length - 1
          const nextRound = !isLast ? rounds[roundIdx + 1] : null
          const currentSetIds = roundSetIds[roundIdx]

          return (
            <Fragment key={round.round}>
              {/* Round label */}
              <div
                className={styles.roundLabel}
                style={{ gridColumn: col, gridRow: 1 }}
              >
                {round.label ?? `Round ${round.round}`}
              </div>

              {/* Set cards */}
              {round.sets.map(set => {
                const pos = positions.get(set.id)
                if (!pos) return null
                const rowStart = Math.round(pos.start) + 2
                const rowEnd = Math.max(Math.round(pos.end) + 2, rowStart + 1)
                return (
                  <div
                    key={set.id}
                    className={styles.setWrapper}
                    data-entrant-ids={
                      [set.entrants[0]?.id, set.entrants[1]?.id]
                        .filter(Boolean)
                        .join(',')
                    }
                    style={{
                      gridColumn: col,
                      gridRow: `${rowStart} / ${rowEnd}`,
                    }}
                  >
                    <SetCard
                      set={set}
                      userEntrantId={userEntrantId}
                      projectedResults={projectedResults}
                      entrantPlayerMap={entrantPlayerMap}
                    />
                  </div>
                )
              })}

              {/* Header spacer for connector column */}
              {!isLast && (
                <div
                  className={styles.headerSpacer}
                  style={{ gridColumn: col + 1, gridRow: 1 }}
                />
              )}

              {/* Connectors based on prereq data */}
              {nextRound &&
                nextRound.sets.map(nextSet => {
                  // Find feeders from current round (deduplicated by set ID)
                  const feeders: string[] = []
                  const seenConn = new Set<string>()
                  for (const prereq of nextSet.prereqs) {
                    if (prereq?.prereqId && prereq.prereqType === 'set') {
                      const pid = String(prereq.prereqId)
                      if (currentSetIds.has(pid) && !seenConn.has(pid)) {
                        seenConn.add(pid)
                        feeders.push(pid)
                      }
                    }
                  }

                  if (feeders.length === 0) return null

                  if (feeders.length >= 2) {
                    // Merge connector spanning both feeders
                    const feederPositions = feeders
                      .map(fid => positions.get(fid))
                      .filter((p): p is TreePosition => p != null)
                    if (feederPositions.length < 2) return null
                    const topStart = Math.min(...feederPositions.map(p => p.start))
                    const botEnd = Math.max(...feederPositions.map(p => p.end))
                    const rowStart = Math.round(topStart) + 2
                    const rowEnd = Math.max(Math.round(botEnd) + 2, rowStart + 1)
                    return (
                      <div
                        key={`conn-${nextSet.id}`}
                        className={styles.connectorPair}
                        style={{
                          gridColumn: col + 1,
                          gridRow: `${rowStart} / ${rowEnd}`,
                        }}
                      />
                    )
                  }

                  // Single feeder -> straight connector
                  const feederPos = positions.get(feeders[0])
                  if (!feederPos) return null
                  const rowStart = Math.round(feederPos.start) + 2
                  const rowEnd = Math.max(Math.round(feederPos.end) + 2, rowStart + 1)
                  return (
                    <div
                      key={`conn-${nextSet.id}`}
                      className={styles.connectorStraight}
                      style={{
                        gridColumn: col + 1,
                        gridRow: `${rowStart} / ${rowEnd}`,
                      }}
                    />
                  )
                })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

function SetCard({
  set,
  userEntrantId,
  projectedResults,
  entrantPlayerMap,
}: {
  set: BracketSet
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
}) {
  const proj = projectedResults?.get(set.id)
  const e0 = proj ? proj.entrants[0] : set.entrants[0]
  const e1 = proj ? proj.entrants[1] : set.entrants[1]
  const winnerId = proj ? proj.winnerId : set.winnerId

  const isE0Winner = winnerId != null && e0?.id === winnerId
  const isE1Winner = winnerId != null && e1?.id === winnerId
  const isE0Loser = winnerId != null && e0?.id != null && e0.id !== winnerId
  const isE1Loser = winnerId != null && e1?.id != null && e1.id !== winnerId

  // Suppress scores for projected sets; show W/L for DQ sets
  let score0: string | null = null
  let score1: string | null = null
  if (!proj) {
    if (set.isDQ) {
      score0 = isE0Winner ? 'W' : isE0Loser ? 'L' : null
      score1 = isE1Winner ? 'W' : isE1Loser ? 'L' : null
    } else {
      ;[score0, score1] = set.scores
    }
  }

  const isUserSet = userEntrantId != null && (e0?.id === userEntrantId || e1?.id === userEntrantId)
  const cardClass = `${styles.setCard} ${isUserSet ? styles.setCardUser : ''}`

  return (
    <div className={cardClass}>
      <EntrantRow
        entrant={e0}
        isWinner={isE0Winner}
        isLoser={isE0Loser}
        isUser={userEntrantId != null && e0?.id === userEntrantId}
        playerId={e0?.id ? entrantPlayerMap.get(e0.id) : undefined}
        score={score0}
      />
      <EntrantRow
        entrant={e1}
        isWinner={isE1Winner}
        isLoser={isE1Loser}
        isUser={userEntrantId != null && e1?.id === userEntrantId}
        playerId={e1?.id ? entrantPlayerMap.get(e1.id) : undefined}
        score={score1}
      />
    </div>
  )
}

function EntrantRow({
  entrant,
  isWinner,
  isLoser,
  isUser,
  playerId,
  score,
}: {
  entrant: BracketEntrant | null
  isWinner: boolean
  isLoser: boolean
  isUser: boolean
  playerId?: string
  score: string | null
}) {
  const rowClass = [
    styles.entrantRow,
    isWinner && styles.entrantRowWinner,
    isLoser && styles.entrantRowLoser,
  ]
    .filter(Boolean)
    .join(' ')

  if (!entrant) {
    return (
      <div className={rowClass}>
        <span className={styles.entrantSeed}>&mdash;</span>
        <span className={`${styles.entrantName} ${styles.entrantNameTBD}`}>TBD</span>
      </div>
    )
  }

  const nameClass = [
    styles.entrantName,
    isUser && styles.entrantNameUser,
    entrant.isProjected && !isUser && styles.entrantNameProjected,
    isWinner && styles.entrantWinner,
    isLoser && styles.entrantLoser,
  ]
    .filter(Boolean)
    .join(' ')

  const scoreClass = [
    styles.entrantScore,
    isWinner && styles.entrantScoreWinner,
    isLoser && styles.entrantScoreLoser,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rowClass}>
      <span className={styles.entrantSeed}>
        {entrant.seedNum ?? '—'}
      </span>
      {playerId ? (
        <Link
          to="/player/$playerId"
          params={{ playerId }}
          search={{}}
          className={`${nameClass} ${styles.entrantNameLink}`}
        >
          {entrant.name}
        </Link>
      ) : (
        <span className={nameClass}>{entrant.name}</span>
      )}
      {score != null && <span className={scoreClass}>{score}</span>}
    </div>
  )
}
