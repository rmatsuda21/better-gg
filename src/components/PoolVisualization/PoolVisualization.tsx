import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { BracketData, BracketSet, BracketEntrant, SetClickInfo, SetClickParticipant, PhaseNavInfo } from '../../lib/bracket-utils'
import { computePoolStandings } from '../../lib/bracket-utils'
import { DataTable, DataTableHeader, DataTableRow } from '../DataTable/DataTable'
import styles from './PoolVisualization.module.css'

interface PoolVisualizationProps {
  bracketData: BracketData
  bracketType: string
  userEntrantId?: string
  entrantPlayerMap: Map<string, string>
  entrantParticipantsMap?: Map<string, SetClickParticipant[]>
  eventId?: string
  phaseNav?: PhaseNavInfo
  onSetClick?: (info: SetClickInfo) => void
}

export function PoolVisualization({
  bracketData,
  bracketType,
  userEntrantId,
  entrantPlayerMap,
  entrantParticipantsMap,
  onSetClick,
}: PoolVisualizationProps) {
  const standings = useMemo(
    () => computePoolStandings(bracketData),
    [bracketData],
  )

  return (
    <div className={styles.wrapper}>
      {/* Standings Table */}
      <StandingsTable
        standings={standings}
        userEntrantId={userEntrantId}
        entrantPlayerMap={entrantPlayerMap}
      />

      {/* Round-by-Round Matchups */}
      {bracketData.winnersRounds.map((round) => (
        <div key={round.round} className={styles.roundSection}>
          <div className={styles.roundLabel}>
            {bracketType === 'SWISS'
              ? `Swiss Round ${round.round}`
              : round.label ?? `Round ${round.round}`}
          </div>
          <div className={styles.roundGrid}>
            {round.sets.map((set) => (
              <MatchCard
                key={set.id}
                set={set}
                userEntrantId={userEntrantId}
                entrantPlayerMap={entrantPlayerMap}
                entrantParticipantsMap={entrantParticipantsMap}
                onSetClick={onSetClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function StandingsTable({
  standings,
  userEntrantId,
  entrantPlayerMap,
}: {
  standings: ReturnType<typeof computePoolStandings>
  userEntrantId?: string
  entrantPlayerMap: Map<string, string>
}) {
  const gridStyle = { gridTemplateColumns: '36px 1fr 44px 44px 56px' }

  return (
    <DataTable variant="gap" className={styles.standings}>
      <DataTableHeader className={styles.standingsGrid} style={gridStyle}>
        <span className={styles.rank}>#</span>
        <span>Player</span>
        <span className={styles.stat}>W</span>
        <span className={styles.stat}>L</span>
        <span className={styles.winRate}>Win%</span>
      </DataTableHeader>
      {standings.map((s, i) => {
        const isUser = userEntrantId != null && s.entrant.id === userEntrantId
        const playerId = s.entrant.id ? entrantPlayerMap.get(s.entrant.id) : undefined
        const total = s.wins + s.losses
        const winPct = total > 0 ? Math.round((s.wins / total) * 100) : 0

        return (
          <div key={s.entrant.id ?? i} data-entrant-ids={s.entrant.id ?? undefined}>
          <DataTableRow
            className={`${styles.standingsGrid}${isUser ? ` ${styles.userRow}` : ''}`}
            style={gridStyle}
          >
            <span className={styles.rank}>{i + 1}</span>
            <span className={`${styles.playerName}${isUser ? ` ${styles.playerNameUser}` : ''}`}>
              {playerId ? (
                <Link
                  to="/player/$playerId"
                  params={{ playerId }}
                  search={{}}
                  className={styles.playerLink}
                >
                  {s.entrant.prefix && <span className={styles.prefix}>{s.entrant.prefix}</span>}
                  {s.entrant.name}
                </Link>
              ) : (
                <>
                  {s.entrant.prefix && <span className={styles.prefix}>{s.entrant.prefix}</span>}
                  {s.entrant.name}
                </>
              )}
            </span>
            <span className={`${styles.stat} ${styles.statWins}`}>{s.wins}</span>
            <span className={`${styles.stat} ${styles.statLosses}`}>{s.losses}</span>
            <span className={styles.winRate}>{winPct}%</span>
          </DataTableRow>
          </div>
        )
      })}
    </DataTable>
  )
}

function MatchCard({
  set,
  userEntrantId,
  entrantPlayerMap,
  entrantParticipantsMap,
  onSetClick,
}: {
  set: BracketSet
  userEntrantId?: string
  entrantPlayerMap: Map<string, string>
  entrantParticipantsMap?: Map<string, SetClickParticipant[]>
  onSetClick?: (info: SetClickInfo) => void
}) {
  const [e0, e1] = set.entrants
  const winnerId = set.winnerId

  const isE0Winner = winnerId != null && e0?.id === winnerId
  const isE1Winner = winnerId != null && e1?.id === winnerId
  const isE0Loser = winnerId != null && e0?.id != null && e0.id !== winnerId
  const isE1Loser = winnerId != null && e1?.id != null && e1.id !== winnerId

  let score0: string | null = null
  let score1: string | null = null
  if (set.isDQ) {
    score0 = isE0Winner ? 'W' : isE0Loser ? 'L' : null
    score1 = isE1Winner ? 'W' : isE1Loser ? 'L' : null
  } else {
    ;[score0, score1] = set.scores
  }

  const isUserSet = userEntrantId != null && (e0?.id === userEntrantId || e1?.id === userEntrantId)
  const isClickable = onSetClick != null

  const cardClass = [
    styles.matchCard,
    isUserSet && styles.matchCardUser,
    isClickable && styles.matchCardClickable,
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
      data-entrant-ids={
        [e0?.id, e1?.id].filter(Boolean).join(',')
      }
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
      <MatchEntrantRow
        entrant={e0}
        isWinner={isE0Winner}
        isLoser={isE0Loser}
        isUser={userEntrantId != null && e0?.id === userEntrantId}
        playerId={e0?.id ? entrantPlayerMap.get(e0.id) : undefined}
        score={score0}
      />
      <MatchEntrantRow
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

/** Pool-shaped loading state using real match card styles. */
export function PoolLoadingState() {
  const shimmerRow = (
    <div className={styles.entrantRow}>
      <span className={styles.shimmerSeed} />
      <span className={styles.shimmerName} />
      <span className={styles.shimmerScore} />
    </div>
  )
  const shimmerCard = (
    <div className={styles.matchCard}>
      {shimmerRow}
      {shimmerRow}
    </div>
  )
  const standingsRow = (
    <DataTableRow className={styles.standingsGrid}>
      <div><span className={styles.shimmerRank} /></div>
      <div><span className={styles.shimmerPlayerName} /></div>
      <div><span className={styles.shimmerStat} /></div>
      <div><span className={styles.shimmerStat} /></div>
      <div><span className={styles.shimmerStat} /></div>
    </DataTableRow>
  )

  return (
    <div className={styles.wrapper}>
      <div className={styles.standings}>
        <DataTable>
          <DataTableHeader className={styles.standingsGrid}>
            <div>#</div>
            <div>Player</div>
            <div>W</div>
            <div>L</div>
            <div>Win%</div>
          </DataTableHeader>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>{standingsRow}</div>
          ))}
        </DataTable>
      </div>
      <div className={styles.roundSection}>
        <div className={styles.roundLabel}>Round 1</div>
        <div className={styles.roundGrid}>
          {shimmerCard}
          {shimmerCard}
          {shimmerCard}
        </div>
      </div>
    </div>
  )
}

function MatchEntrantRow({
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
  ].filter(Boolean).join(' ')

  if (!entrant) {
    return (
      <div className={rowClass}>
        <span className={styles.entrantSeed}>&mdash;</span>
        <span className={styles.entrantName}>BYE</span>
      </div>
    )
  }

  const nameClass = [
    styles.entrantName,
    isUser && styles.entrantNameUser,
    isWinner && styles.entrantWinner,
    isLoser && styles.entrantLoser,
  ].filter(Boolean).join(' ')

  const scoreClass = [
    styles.entrantScore,
    isWinner && styles.entrantScoreWinner,
    isLoser && styles.entrantScoreLoser,
  ].filter(Boolean).join(' ')

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
            {entrant.prefix && <span className={styles.prefix}>{entrant.prefix}</span>}
            {entrant.name}
          </Link>
        </span>
      ) : (
        <span className={nameClass}>
          {entrant.prefix && <span className={styles.prefix}>{entrant.prefix}</span>}
          {entrant.name}
        </span>
      )}
      {score != null && <span className={scoreClass}>{score}</span>}
    </div>
  )
}
