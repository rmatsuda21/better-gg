import { Fragment, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import type {
  BracketData,
  BracketRound,
  BracketSet,
  BracketEntrant,
  ProjectedSet,
  PhaseNavInfo,
  SetClickInfo,
  SetProgressionInfo,
} from '../../lib/bracket-utils'
import { useDragScroll } from '../../hooks/use-drag-scroll'
import styles from './BracketVisualization.module.css'

interface BracketVisualizationProps {
  bracketData: BracketData
  projectedResults?: Map<string, ProjectedSet> | null
  userEntrantId?: string
  entrantPlayerMap: Map<string, string>
  eventId?: string
  phaseNav?: PhaseNavInfo
  progressionMap?: Map<string, SetProgressionInfo>
  onSetClick?: (info: SetClickInfo) => void
}

export function BracketVisualization({
  bracketData,
  projectedResults,
  userEntrantId,
  entrantPlayerMap,
  eventId,
  phaseNav,
  progressionMap,
  onSetClick,
}: BracketVisualizationProps) {
  return (
    <div className={styles.wrapper}>
      {bracketData.winnersRounds.length > 0 && (
        <>
          {bracketData.losersRounds.length > 0 && (
            <div className={styles.sectionLabel}>Winners Bracket</div>
          )}
          <BracketSection
            rounds={bracketData.winnersRounds}
            userEntrantId={userEntrantId}
            projectedResults={projectedResults ?? null}
            entrantPlayerMap={entrantPlayerMap}
            eventId={eventId}
            prevPhase={phaseNav?.prevPhase ?? null}
            nextPhase={phaseNav?.nextPhase ?? null}
            progressionMap={progressionMap}
            onSetClick={onSetClick}
          />
        </>
      )}

      {bracketData.losersRounds.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Losers Bracket</div>
          <BracketSection
            rounds={bracketData.losersRounds}
            userEntrantId={userEntrantId}
            projectedResults={projectedResults ?? null}
            entrantPlayerMap={entrantPlayerMap}
            eventId={eventId}
            prevPhase={phaseNav?.prevPhase ?? null}
            nextPhase={phaseNav?.nextPhase ?? null}
            progressionMap={progressionMap}
            onSetClick={onSetClick}
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
  for (let ri = 0; ri < rounds.length; ri++) {
    for (const s of rounds[ri].sets) {
      setById.set(s.id, s)
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
    // Check if this root's feeders are already positioned (shared subtree)
    const feeders: string[] = []
    for (const prereq of root.prereqs) {
      if (prereq?.prereqId && prereq.prereqType === 'set') {
        const pid = String(prereq.prereqId)
        if (setById.has(pid)) feeders.push(pid)
      }
    }
    const allFeedersPositioned = feeders.length > 0 && feeders.every(fid => positions.has(fid))

    if (allFeedersPositioned) {
      // Shared feeder subtree — position root based on existing feeder positions
      const feederPositions = feeders.map(fid => positions.get(fid)!)
      const start = Math.min(...feederPositions.map(p => p.start))
      const end = Math.max(...feederPositions.map(p => p.end))
      positions.set(root.id, { start, end })
    } else {
      const lc = getLeafCount(root.id)
      assignPositions(root.id, rootCursor, rootCursor + lc)
      rootCursor += lc
    }
  }

  // Use actual cursor (excludes shared roots) for totalLeaves
  totalLeaves = rootCursor || 1

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
  eventId,
  prevPhase,
  nextPhase,
  progressionMap,
  onSetClick,
}: {
  rounds: BracketRound[]
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
  eventId?: string
  prevPhase?: { id: string; name: string } | null
  nextPhase?: { id: string; name: string } | null
  progressionMap?: Map<string, SetProgressionInfo>
  onSetClick?: (info: SetClickInfo) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useDragScroll(scrollRef)

  if (rounds.length === 0) return null

  const { positions, totalLeaves } = computeTreePositions(rounds)

  // Grid columns: round columns + inter-round connectors (no FROM/TO phase columns)
  const parts: string[] = []
  for (let i = 0; i < rounds.length; i++) {
    parts.push('minmax(200px, max-content)')
    if (i < rounds.length - 1) parts.push('24px')
  }
  const colTemplate = parts.join(' ')

  // Build a set of set IDs per round for quick lookup in connector logic
  const roundSetIds: Set<string>[] = rounds.map(
    r => new Set(r.sets.map(s => s.id)),
  )

  // Compute per-set winner phase for last-round sets
  const lastRoundSets = rounds[rounds.length - 1]?.sets ?? []
  const perSetWinnerPhases = progressionMap && eventId
    ? new Map(lastRoundSets.map(set => {
        const prog = progressionMap.get(set.id)
        return [set.id, prog?.winnerPhase ?? null] as const
      }))
    : null

  return (
    <div ref={scrollRef} className={styles.scrollContainer}>
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
            <Fragment key={roundIdx}>
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

                // Source phase badge for first-round sets
                const sourcePhase = roundIdx === 0 && prevPhase && eventId
                  ? { id: prevPhase.id, name: prevPhase.name, eventId }
                  : undefined

                // Winner destination badge for last-round sets
                const winnerPhase = isLast
                  ? (perSetWinnerPhases?.get(set.id) ?? (!progressionMap && nextPhase ? nextPhase : null))
                  : null
                const winnerDest = winnerPhase && eventId
                  ? { phase: winnerPhase, eventId }
                  : undefined

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
                      progressionInfo={progressionMap?.get(set.id)}
                      eventId={eventId}
                      sourcePhase={sourcePhase}
                      winnerDest={winnerDest}
                      onSetClick={onSetClick}
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
                    const span = botEnd - topStart
                    // Compute arm positions as percentages based on actual feeder centers
                    const topCenter = ((feederPositions[0].start + feederPositions[0].end) / 2 - topStart) / span
                    const botCenter = ((feederPositions[1].start + feederPositions[1].end) / 2 - topStart) / span
                    const mid = (topCenter + botCenter) / 2
                    const rowStart = Math.round(topStart) + 2
                    const rowEnd = Math.max(Math.round(botEnd) + 2, rowStart + 1)
                    return (
                      <div
                        key={`conn-${nextSet.id}`}
                        className={styles.connectorPair}
                        style={{
                          gridColumn: col + 1,
                          gridRow: `${rowStart} / ${rowEnd}`,
                          '--arm-top': `${topCenter * 100}%`,
                          '--arm-mid': `${mid * 100}%`,
                          '--arm-bottom': `${botCenter * 100}%`,
                        } as React.CSSProperties}
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
  progressionInfo,
  eventId,
  sourcePhase,
  winnerDest,
  onSetClick,
}: {
  set: BracketSet
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
  progressionInfo?: SetProgressionInfo
  eventId?: string
  sourcePhase?: { id: string; name: string; eventId: string }
  winnerDest?: { phase: { id: string; name: string }; eventId: string }
  onSetClick?: (info: SetClickInfo) => void
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
  const isClickable = onSetClick != null
  const cardClass = [
    styles.setCard,
    isUserSet && styles.setCardUser,
    isClickable && styles.setCardClickable,
  ].filter(Boolean).join(' ')

  // Determine destination badge for the losing entrant
  const loserDest = progressionInfo?.loserPhase && eventId
    ? { phase: progressionInfo.loserPhase, eventId }
    : undefined

  const handleClick = () => {
    if (!onSetClick) return
    onSetClick({
      setId: set.id,
      fullRoundText: set.fullRoundText,
      winnerId: set.winnerId,
      scores: [score0, score1],
      isDQ: set.isDQ,
      entrants: [
        e0 ? { id: e0.id, name: e0.name, playerId: e0.id ? entrantPlayerMap.get(e0.id) ?? null : null, seedNum: e0.seedNum } : null,
        e1 ? { id: e1.id, name: e1.name, playerId: e1.id ? entrantPlayerMap.get(e1.id) ?? null : null, seedNum: e1.seedNum } : null,
      ],
    })
  }

  return (
    <div
      className={cardClass}
      {...(isClickable ? {
        role: 'button',
        tabIndex: 0,
        onClick: (e: React.MouseEvent) => {
          if ((e.target as HTMLElement).closest('a')) return
          handleClick()
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        },
      } : {})}
    >
      {sourcePhase && (
        <Link
          to="/event/$eventId/phase/$phaseId"
          params={{ eventId: sourcePhase.eventId, phaseId: sourcePhase.id }}
          search={userEntrantId ? { entrantId: userEntrantId } : {}}
          className={styles.sourceBadge}
        >
          &larr; {sourcePhase.name}
        </Link>
      )}
      <EntrantRow
        entrant={e0}
        isWinner={isE0Winner}
        isLoser={isE0Loser}
        isUser={userEntrantId != null && e0?.id === userEntrantId}
        playerId={e0?.id ? entrantPlayerMap.get(e0.id) : undefined}
        score={score0}
        destinationBadge={isE0Loser ? loserDest : (isE0Winner ? winnerDest : undefined)}
      />
      <EntrantRow
        entrant={e1}
        isWinner={isE1Winner}
        isLoser={isE1Loser}
        isUser={userEntrantId != null && e1?.id === userEntrantId}
        playerId={e1?.id ? entrantPlayerMap.get(e1.id) : undefined}
        score={score1}
        destinationBadge={isE1Loser ? loserDest : (isE1Winner ? winnerDest : undefined)}
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
  destinationBadge,
}: {
  entrant: BracketEntrant | null
  isWinner: boolean
  isLoser: boolean
  isUser: boolean
  playerId?: string
  score: string | null
  destinationBadge?: { phase: { id: string; name: string }; eventId: string }
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
        <span className={nameClass}>
          <Link
            to="/player/$playerId"
            params={{ playerId }}
            search={{}}
            className={styles.entrantNameLink}
          >
            {entrant.prefix && <span className={styles.entrantPrefix}>{entrant.prefix}</span>}
            {entrant.name}
          </Link>
        </span>
      ) : (
        <span className={nameClass}>
          {entrant.prefix && <span className={styles.entrantPrefix}>{entrant.prefix}</span>}
          {entrant.name}
        </span>
      )}
      {score != null && <span className={scoreClass}>{score}</span>}
      {destinationBadge && (
        <Link
          to="/event/$eventId/phase/$phaseId"
          params={{ eventId: destinationBadge.eventId, phaseId: destinationBadge.phase.id }}
          search={entrant.id ? { entrantId: String(entrant.id) } : {}}
          className={styles.destinationBadge}
        >
          &rarr; {destinationBadge.phase.name}
        </Link>
      )}
    </div>
  )
}
