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
        if (playerId) map.set(entrant.id, playerId)
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

  const maxSets = Math.max(...rounds.map(r => r.sets.length))

  // Grid columns: for each round a set column + connector column (except last)
  const colTemplate = rounds
    .map((_, i) =>
      i < rounds.length - 1 ? 'minmax(200px, 1fr) 24px' : 'minmax(200px, 1fr)'
    )
    .join(' ')

  return (
    <div className={styles.scrollContainer}>
      <div
        className={styles.bracket}
        style={{
          gridTemplateColumns: colTemplate,
          gridTemplateRows: `auto repeat(${maxSets}, 1fr)`,
        }}
      >
        {rounds.map((round, roundIdx) => {
          const col = roundIdx * 2 + 1
          const rowSpan = maxSets / round.sets.length
          const isLast = roundIdx === rounds.length - 1
          const nextRound = !isLast ? rounds[roundIdx + 1] : null
          const isMerge =
            nextRound != null &&
            round.sets.length > 1 &&
            nextRound.sets.length === Math.ceil(round.sets.length / 2)

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
              {round.sets.map((set, setIdx) => {
                const rowStart = Math.round(setIdx * rowSpan) + 2
                const rowEnd = Math.round((setIdx + 1) * rowSpan) + 2
                return (
                  <div
                    key={set.id}
                    className={styles.setWrapper}
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

              {/* Merge connectors: pairs of sets feed one set in next round */}
              {isMerge &&
                Array.from(
                  { length: Math.ceil(round.sets.length / 2) },
                  (_, pairIdx) => {
                    const topIdx = pairIdx * 2
                    const botIdx = Math.min(pairIdx * 2 + 1, round.sets.length - 1)
                    const pairStart = Math.round(topIdx * rowSpan) + 2
                    const pairEnd = Math.round((botIdx + 1) * rowSpan) + 2

                    if (topIdx === botIdx) {
                      return (
                        <div
                          key={`conn-${pairIdx}`}
                          className={styles.connectorStraight}
                          style={{
                            gridColumn: col + 1,
                            gridRow: `${pairStart} / ${pairEnd}`,
                          }}
                        />
                      )
                    }
                    return (
                      <div
                        key={`conn-${pairIdx}`}
                        className={styles.connectorPair}
                        style={{
                          gridColumn: col + 1,
                          gridRow: `${pairStart} / ${pairEnd}`,
                        }}
                      />
                    )
                  }
                )}

              {/* Straight connectors: non-merge transitions */}
              {!isLast && !isMerge &&
                round.sets.map((set, setIdx) => {
                  const rowStart = Math.round(setIdx * rowSpan) + 2
                  const rowEnd = Math.round((setIdx + 1) * rowSpan) + 2
                  return (
                    <div
                      key={`conn-${set.id}`}
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

  const isUserSet = e0?.id === userEntrantId || e1?.id === userEntrantId
  const cardClass = `${styles.setCard} ${isUserSet ? styles.setCardUser : ''}`

  return (
    <div className={cardClass}>
      <EntrantRow
        entrant={e0}
        isWinner={winnerId != null && e0?.id === winnerId}
        isLoser={winnerId != null && e0?.id != null && e0.id !== winnerId}
        isUser={e0?.id === userEntrantId}
        playerId={e0?.id ? entrantPlayerMap.get(e0.id) : undefined}
      />
      <EntrantRow
        entrant={e1}
        isWinner={winnerId != null && e1?.id === winnerId}
        isLoser={winnerId != null && e1?.id != null && e1.id !== winnerId}
        isUser={e1?.id === userEntrantId}
        playerId={e1?.id ? entrantPlayerMap.get(e1.id) : undefined}
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
}: {
  entrant: BracketEntrant | null
  isWinner: boolean
  isLoser: boolean
  isUser: boolean
  playerId?: string
}) {
  if (!entrant) {
    return (
      <div className={styles.entrantRow}>
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

  return (
    <div className={styles.entrantRow}>
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
    </div>
  )
}
