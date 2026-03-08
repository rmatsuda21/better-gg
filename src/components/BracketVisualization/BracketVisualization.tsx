import { useState } from 'react'
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
  userEntrantId: string
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
}: BracketVisualizationProps) {
  const [showProjected, setShowProjected] = useState(false)
  const bracketData = buildBracketData(phaseGroup, userEntrantId)
  const projectedResults = showProjected
    ? buildProjectedResults(bracketData)
    : null
  const entrantPlayerMap = buildEntrantPlayerMap(phaseGroup)

  return (
    <div className={styles.wrapper}>
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
  userEntrantId: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
}) {
  return (
    <div className={styles.scrollContainer}>
      <div className={styles.bracket}>
        {rounds.map((round, roundIdx) => (
          <RoundWithConnector
            key={round.round}
            round={round}
            userEntrantId={userEntrantId}
            projectedResults={projectedResults}
            entrantPlayerMap={entrantPlayerMap}
            isLast={roundIdx === rounds.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function RoundWithConnector({
  round,
  userEntrantId,
  projectedResults,
  entrantPlayerMap,
  isLast,
}: {
  round: BracketRound
  userEntrantId: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
  isLast: boolean
}) {
  return (
    <>
      <div className={styles.roundColumn}>
        <div className={styles.roundLabel}>{round.label ?? `Round ${round.round}`}</div>
        <div className={styles.roundSets}>
          {round.sets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              userEntrantId={userEntrantId}
              projectedResults={projectedResults}
              entrantPlayerMap={entrantPlayerMap}
            />
          ))}
        </div>
      </div>
      {!isLast && round.sets.length > 1 && (
        <div className={styles.connectorColumn}>
          <div className={styles.roundSets}>
            {round.sets.map((set, i) => (
              <div key={set.id} className={styles.connector}>
                <div
                  className={`${styles.connectorLine} ${
                    i % 2 === 0 ? styles.connectorTop : styles.connectorBottom
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {!isLast && round.sets.length === 1 && (
        <div className={styles.connectorColumn}>
          <div className={styles.roundSets}>
            <div className={styles.connector}>
              <div className={`${styles.connectorLine} ${styles.connectorStraight}`} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SetCard({
  set,
  userEntrantId,
  projectedResults,
  entrantPlayerMap,
}: {
  set: BracketSet
  userEntrantId: string
  projectedResults: Map<string, ProjectedSet> | null
  entrantPlayerMap: Map<string, string>
}) {
  // Use projected data if available, otherwise use actual set data
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
