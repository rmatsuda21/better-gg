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
  SetClickParticipant,
  SetProgressionInfo,
} from '../../lib/bracket-utils'
import type { OriginPhaseGroupInfo } from '../../hooks/use-origin-phase-map'
import { useDragScroll } from '../../hooks/use-drag-scroll'
import styles from './BracketVisualization.module.css'

interface BracketVisualizationProps {
  bracketData: BracketData
  projectedResults?: Map<string, ProjectedSet> | null
  userEntrantId?: string
  entrantPlayerMap: Map<string, string>
  entrantParticipantsMap?: Map<string, SetClickParticipant[]>
  eventId?: string
  phaseNav?: PhaseNavInfo
  progressionMap?: Map<string, SetProgressionInfo>
  originPhaseMap?: Map<string, OriginPhaseGroupInfo>
  onSetClick?: (info: SetClickInfo) => void
}

export function BracketVisualization({
  bracketData,
  projectedResults,
  userEntrantId,
  entrantPlayerMap,
  entrantParticipantsMap,
  eventId,
  phaseNav,
  progressionMap,
  originPhaseMap,
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
            entrantParticipantsMap={entrantParticipantsMap}
            eventId={eventId}
            prevPhase={phaseNav?.prevPhase ?? null}
            progressionMap={progressionMap}
            originPhaseMap={originPhaseMap}
            hasLosersBracket={bracketData.losersRounds.length > 0}
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
            entrantParticipantsMap={entrantParticipantsMap}
            eventId={eventId}
            prevPhase={phaseNav?.prevPhase ?? null}
            progressionMap={progressionMap}
            originPhaseMap={originPhaseMap}
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
  entrantParticipantsMap,
  eventId,
  prevPhase,
  progressionMap,
  originPhaseMap,
  hasLosersBracket,
  onSetClick,
}: {
  rounds: BracketRound[]
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
  entrantParticipantsMap?: Map<string, SetClickParticipant[]>
  eventId?: string
  prevPhase?: { id: string; name: string; groupCount: number | null } | null
  progressionMap?: Map<string, SetProgressionInfo>
  originPhaseMap?: Map<string, OriginPhaseGroupInfo>
  hasLosersBracket?: boolean
  onSetClick?: (info: SetClickInfo) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useDragScroll(scrollRef)

  if (rounds.length === 0) return null

  const { positions, totalLeaves } = computeTreePositions(rounds)

  // Determine whether source/dest nav columns are needed
  const hasSourceNodes = prevPhase != null && eventId != null
  const lastRoundSets = rounds[rounds.length - 1]?.sets ?? []
  const hasDestNodes = eventId != null && progressionMap != null && lastRoundSets.some(s => progressionMap.has(s.id))
  const colOffset = hasSourceNodes ? 2 : 0

  // Grid columns: optional source col + connector, round columns + inter-round connectors, optional connector + dest col
  const parts: string[] = []
  if (hasSourceNodes) {
    parts.push('max-content') // source nodes
    parts.push('24px')        // source connector
  }
  for (let i = 0; i < rounds.length; i++) {
    parts.push('minmax(200px, max-content)')
    if (i < rounds.length - 1) parts.push('24px')
  }
  if (hasDestNodes) {
    parts.push('24px')        // dest connector
    parts.push('max-content') // dest nodes
  }
  const colTemplate = parts.join(' ')

  // Build a set of set IDs per round for quick lookup in connector logic
  const roundSetIds: Set<string>[] = rounds.map(
    r => new Set(r.sets.map(s => s.id)),
  )

  // Dest column index
  const totalRoundCols = rounds.length * 2 - 1 // round cols + connector cols
  const destConnectorCol = colOffset + totalRoundCols + 1
  const destNodeCol = destConnectorCol + 1

  return (
    <div ref={scrollRef} className={styles.scrollContainer}>
      <div
        className={styles.bracket}
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `auto repeat(${totalLeaves}, 1fr)`,
        }}
      >
        {/* Source nav column header + nodes */}
      {hasSourceNodes && (
        <>
          <div
            className={styles.headerSpacer}
            style={{ gridColumn: 1, gridRow: 1 }}
          />
          <div
            className={styles.headerSpacer}
            style={{ gridColumn: 2, gridRow: 1 }}
          />
          {rounds[0].sets.map(set => {
            const pos = positions.get(set.id)
            if (!pos) return null
            const rowStart = Math.round(pos.start) + 2
            const rowEnd = Math.max(Math.round(pos.end) + 2, rowStart + 1)

            const proj = projectedResults?.get(set.id)
            const e0 = proj ? proj.entrants[0] : set.entrants[0]
            const e1 = proj ? proj.entrants[1] : set.entrants[1]

            return (
              <Fragment key={`src-${set.id}`}>
                <div
                  className={styles.navNodeWrapper}
                  style={{ gridColumn: 1, gridRow: `${rowStart} / ${rowEnd}` }}
                >
                  {[e0, e1].map((entrant, idx) => {
                    if (!entrant?.id) return null
                    const originPG = originPhaseMap?.get(entrant.id)
                    const label = originPG?.displayIdentifier && prevPhase!.groupCount != null && prevPhase!.groupCount > 1
                      ? `${prevPhase!.name} - ${originPG.displayIdentifier}`
                      : prevPhase!.name
                    return (
                      <NavigationNode
                        key={entrant.id ?? idx}
                        label={label}
                        phaseId={prevPhase!.id}
                        eventId={eventId!}
                        entrantId={entrant.id}
                        direction="source"
                      />
                    )
                  })}
                </div>
                <div
                  className={styles.connectorStraight}
                  style={{ gridColumn: 2, gridRow: `${rowStart} / ${rowEnd}` }}
                />
              </Fragment>
            )
          })}
        </>
      )}

      {rounds.map((round, roundIdx) => {
          const col = roundIdx * 2 + 1 + colOffset
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
                      entrantParticipantsMap={entrantParticipantsMap}
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

      {/* Destination nav column header + nodes */}
      {hasDestNodes && (
        <>
          <div
            className={styles.headerSpacer}
            style={{ gridColumn: destConnectorCol, gridRow: 1 }}
          />
          <div
            className={styles.headerSpacer}
            style={{ gridColumn: destNodeCol, gridRow: 1 }}
          />
          {lastRoundSets.map(set => {
            const prog = progressionMap!.get(set.id)
            if (!prog) return null
            const pos = positions.get(set.id)
            if (!pos) return null
            const rowStart = Math.round(pos.start) + 2
            const rowEnd = Math.max(Math.round(pos.end) + 2, rowStart + 1)

            const proj = projectedResults?.get(set.id)
            const e0 = proj ? proj.entrants[0] : set.entrants[0]
            const e1 = proj ? proj.entrants[1] : set.entrants[1]
            const winnerId = proj ? proj.winnerId : set.winnerId

            // Determine which entrant (e0 top, e1 bottom) is winner/loser
            const isE0Winner = winnerId != null && e0?.id === winnerId
            const isE1Winner = winnerId != null && e1?.id === winnerId

            // Build per-entrant destination: top = e0's dest, bottom = e1's dest
            const e0Dest = isE0Winner && prog.winnerPhase
              ? { phase: prog.winnerPhase, pg: prog.winnerPhaseGroup, entrantId: e0?.id }
              : (!isE0Winner && e0?.id && prog.loserPhase)
                ? { phase: prog.loserPhase, pg: prog.loserPhaseGroup, entrantId: e0.id }
                : null
            const e1Dest = isE1Winner && prog.winnerPhase
              ? { phase: prog.winnerPhase, pg: prog.winnerPhaseGroup, entrantId: e1?.id }
              : (!isE1Winner && e1?.id && prog.loserPhase)
                ? { phase: prog.loserPhase, pg: prog.loserPhaseGroup, entrantId: e1.id }
                : null

            return (
              <Fragment key={`dest-${set.id}`}>
                <div
                  className={styles.connectorStraight}
                  style={{ gridColumn: destConnectorCol, gridRow: `${rowStart} / ${rowEnd}` }}
                />
                <div
                  className={styles.navNodeWrapper}
                  style={{ gridColumn: destNodeCol, gridRow: `${rowStart} / ${rowEnd}` }}
                >
                  {e0Dest ? (
                    <NavigationNode
                      label={formatProgressionLabel(e0Dest.phase, e0Dest.pg)}
                      phaseId={e0Dest.phase.id}
                      eventId={eventId!}
                      entrantId={e0Dest.entrantId ?? userEntrantId}
                      direction="dest"
                    />
                  ) : (
                    <span className={styles.navNodeEliminated}>{hasLosersBracket ? 'To Losers' : 'Eliminated'}</span>
                  )}
                  {e1Dest ? (
                    <NavigationNode
                      label={formatProgressionLabel(e1Dest.phase, e1Dest.pg)}
                      phaseId={e1Dest.phase.id}
                      eventId={eventId!}
                      entrantId={e1Dest.entrantId ?? userEntrantId}
                      direction="dest"
                    />
                  ) : (
                    <span className={styles.navNodeEliminated}>{hasLosersBracket ? 'To Losers' : 'Eliminated'}</span>
                  )}
                </div>
              </Fragment>
            )
          })}
        </>
      )}
      </div>
    </div>
  )
}

function SetCard({
  set,
  userEntrantId,
  projectedResults,
  entrantPlayerMap,
  entrantParticipantsMap,
  onSetClick,
}: {
  set: BracketSet
  userEntrantId?: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
  entrantParticipantsMap?: Map<string, SetClickParticipant[]>
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

  const handleClick = () => {
    if (!onSetClick) return
    onSetClick({
      setId: set.id,
      fullRoundText: set.fullRoundText,
      winnerId: set.winnerId,
      scores: [score0, score1],
      isDQ: set.isDQ,
      entrants: [
        e0 ? { id: e0.id, name: e0.name, playerId: e0.id ? entrantPlayerMap.get(e0.id) ?? null : null, seedNum: e0.seedNum, participants: e0.id ? entrantParticipantsMap?.get(e0.id) : undefined } : null,
        e1 ? { id: e1.id, name: e1.name, playerId: e1.id ? entrantPlayerMap.get(e1.id) ?? null : null, seedNum: e1.seedNum, participants: e1.id ? entrantParticipantsMap?.get(e1.id) : undefined } : null,
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
    </div>
  )
}

function ShimmerRow() {
  return (
    <div className={styles.entrantRow}>
      <span className={styles.shimmerSeed} />
      <span className={styles.shimmerName} />
      <span className={styles.shimmerScore} />
    </div>
  )
}

function ShimmerSetCard() {
  return (
    <div className={styles.setCard}>
      <ShimmerRow />
      <ShimmerRow />
    </div>
  )
}

/** Bracket-shaped loading state using real set card styles. */
export function BracketLoadingState() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.scrollContainer}>
        <div className={styles.loadingGrid}>
          <div className={styles.loadingRound}>
            <ShimmerSetCard />
            <ShimmerSetCard />
            <ShimmerSetCard />
            <ShimmerSetCard />
          </div>
          <div className={styles.loadingRound}>
            <ShimmerSetCard />
            <ShimmerSetCard />
          </div>
          <div className={styles.loadingRound}>
            <ShimmerSetCard />
          </div>
        </div>
      </div>
    </div>
  )
}

function formatProgressionLabel(
  phase: { name: string; groupCount: number | null },
  phaseGroup: { id: string; displayIdentifier: string | null } | null | undefined,
): string {
  if (phase.groupCount != null && phase.groupCount > 1 && phaseGroup?.displayIdentifier) {
    return `${phase.name} - ${phaseGroup.displayIdentifier}`
  }
  return phase.name
}

function NavigationNode({
  label,
  phaseId,
  eventId,
  entrantId,
  direction,
}: {
  label: string
  phaseId: string
  eventId: string
  entrantId?: string | null
  direction: 'source' | 'dest'
}) {
  return (
    <Link
      to="/event/$eventId/phase/$phaseId"
      params={{ eventId, phaseId }}
      search={entrantId ? { entrantId } : {}}
      className={`${styles.navNode} ${direction === 'source' ? styles.navNodeSource : styles.navNodeDest}`}
    >
      {direction === 'source' && <span className={styles.navNodeArrow}>&larr;</span>}
      <span className={styles.navNodeLabel}>{label}</span>
      {direction === 'dest' && <span className={styles.navNodeArrow}>&rarr;</span>}
    </Link>
  )
}
