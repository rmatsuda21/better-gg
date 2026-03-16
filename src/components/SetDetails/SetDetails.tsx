import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { getCharacterStockIcon } from '../../lib/character-utils'
import styles from './SetDetails.module.css'

interface EntrantData {
  id?: string | null
  name?: string | null
  participants?: Array<{
    player?: { id?: string | null } | null
  } | null> | null
}

interface SetSlot {
  entrant?: EntrantData | null
  seed?: {
    entrant?: EntrantData | null
  } | null
}

interface GameSelection {
  entrant?: { id?: string | null } | null
  selectionType?: string | null
  selectionValue?: number | null
}

interface Game {
  orderNum?: number | null
  winnerId?: number | null
  selections?: Array<GameSelection | null> | null
}

interface SetNode {
  id?: string | null
  winnerId?: number | null
  fullRoundText?: string | null
  displayScore?: string | null
  slots?: Array<SetSlot | null> | null
  games?: Array<Game | null> | null
}

interface SetDetailsProps {
  sets: SetNode[]
  userEntrantId: string
  characterMap: Map<number, string>
}

function resolveEntrant(slot: SetSlot | null | undefined) {
  return slot?.entrant ?? slot?.seed?.entrant
}

function getPlayerId(entrant: EntrantData | null | undefined): string | null {
  const id = entrant?.participants?.[0]?.player?.id
  return id ?? null
}

function parseScores(
  displayScore: string | null | undefined,
): [string | null, string | null] {
  if (!displayScore) return [null, null]
  if (displayScore === 'DQ') return ['DQ', 'DQ']
  const halves = displayScore.split(' - ')
  if (halves.length !== 2) return [null, null]
  return [
    halves[0].trim().split(/\s+/).pop() ?? null,
    halves[1].trim().split(/\s+/).pop() ?? null,
  ]
}

export function SetDetails({
  sets,
  userEntrantId,
  characterMap,
}: SetDetailsProps) {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set())

  if (sets.length === 0) {
    return <p className={styles.empty}>No set results available</p>
  }

  function toggleSet(id: string) {
    setExpandedSets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={styles.list}>
      {sets.map((set) => {
        const userSlot = set.slots?.find(
          (s) => resolveEntrant(s)?.id === userEntrantId,
        )
        const oppSlot = set.slots?.find(
          (s) => {
            const e = resolveEntrant(s)
            return e?.id != null && e.id !== userEntrantId
          },
        )

        const userEntrant = resolveEntrant(userSlot)
        const oppEntrant = resolveEntrant(oppSlot)
        const userName = userEntrant?.name ?? 'You'
        const oppName = oppEntrant?.name ?? 'Opponent'
        const userPlayerId = getPlayerId(userEntrant)
        const oppPlayerId = getPlayerId(oppEntrant)

        const userEntrantNumId = Number(userEntrantId)
        const scores = parseScores(set.displayScore)
        const isSlot0User = resolveEntrant(set.slots?.[0])?.id === userEntrantId
        const userScore = scores[isSlot0User ? 0 : 1]
        const oppScore = scores[isSlot0User ? 1 : 0]

        const userIsWinner = set.winnerId === userEntrantNumId
        const oppIsWinner = set.winnerId != null && !userIsWinner

        const gamesWithSelections = (set.games ?? []).filter(
          (g): g is NonNullable<typeof g> =>
            g != null &&
            (g.selections ?? []).some((s) => s?.selectionType === 'CHARACTER'),
        )
        const hasGames = gamesWithSelections.length > 0
        const setId = String(set.id ?? '')
        const isExpanded = expandedSets.has(setId)

        return (
          <div key={set.id} className={`${styles.setCard} ${hasGames ? styles.setCardExpandable : ''}`}>
            {/* Set header: Opp | scores + round | User */}
            <div
              className={`${styles.setHeader} ${hasGames ? styles.setHeaderClickable : ''}`}
              {...(hasGames
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => toggleSet(setId),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleSet(setId)
                      }
                    },
                  }
                : {})}>

              <div className={`${styles.playerSide} ${styles.left}`}>
                {oppPlayerId ? (
                  <Link
                    to="/player/$playerId"
                    params={{ playerId: oppPlayerId }}
                    className={styles.playerName}
                  >
                    {oppName}
                  </Link>
                ) : (
                  <span className={styles.playerName}>{oppName}</span>
                )}
                {oppScore != null && (
                  <span
                    className={`${styles.playerScore} ${oppIsWinner ? styles.winner : styles.loser}`}
                  >
                    {oppScore}
                  </span>
                )}
              </div>

              <div className={styles.scoreCenter}>
                <span className={styles.roundLabel}>
                  {set.fullRoundText ?? 'Round'}
                </span>
                {set.winnerId != null && (
                  <span className={styles.arrow}>
                    {userIsWinner ? '▶' : '◀'}
                  </span>
                )}
                {hasGames && (
                  <span className={`${styles.gamesBadge} ${isExpanded ? styles.gamesBadgeExpanded : ''}`}>
                    {gamesWithSelections.length} game{gamesWithSelections.length !== 1 ? 's' : ''}
                    <span className={styles.badgeChevron}>▾</span>
                  </span>
                )}
              </div>

              <div className={`${styles.playerSide} ${styles.right}`}>
                {userScore != null && (
                  <span
                    className={`${styles.playerScore} ${userIsWinner ? styles.winner : styles.loser}`}
                  >
                    {userScore}
                  </span>
                )}
                {userPlayerId ? (
                  <Link
                    to="/player/$playerId"
                    params={{ playerId: userPlayerId }}
                    className={styles.playerName}
                  >
                    {userName}
                  </Link>
                ) : (
                  <span className={styles.playerName}>{userName}</span>
                )}
              </div>
            </div>

            {/* Game rows */}
            {isExpanded && gamesWithSelections.length > 0 && (
              <div className={styles.games}>
                {gamesWithSelections.map((game) => {
                  const userChar = game.selections?.find(
                    (s) =>
                      s?.selectionType === 'CHARACTER' &&
                      s.entrant?.id === userEntrantId,
                  )
                  const oppChar = game.selections?.find(
                    (s) =>
                      s?.selectionType === 'CHARACTER' &&
                      s.entrant?.id !== userEntrantId,
                  )
                  const gameUserWon = game.winnerId === userEntrantNumId
                  const hasWinner = game.winnerId != null

                  const oppCharName =
                    oppChar?.selectionValue != null
                      ? (characterMap.get(oppChar.selectionValue) ??
                        `#${oppChar.selectionValue}`)
                      : '?'
                  const userCharName =
                    userChar?.selectionValue != null
                      ? (characterMap.get(userChar.selectionValue) ??
                        `#${userChar.selectionValue}`)
                      : '?'

                  return (
                    <div key={game.orderNum} className={styles.gameRow}>
                      {/* Opponent side */}
                      <div className={`${styles.gameSide} ${styles.left}`}>
                        {oppChar?.selectionValue != null && (
                          <img
                            src={getCharacterStockIcon(oppChar.selectionValue)}
                            alt=""
                            className={styles.charIcon}
                          />
                        )}
                        <span className={styles.charName}>{oppCharName}</span>
                        {hasWinner && (
                          <span
                            className={`${styles.resultBadge} ${gameUserWon ? styles.loss : styles.win}`}
                          >
                            {gameUserWon ? 'L' : 'W'}
                          </span>
                        )}
                      </div>

                      {/* Center */}
                      <div className={styles.gameCenter}>
                        <span className={styles.gameLabel}>
                          Game {game.orderNum}
                        </span>
                        {hasWinner && (
                          <span className={styles.gameArrow}>
                            {gameUserWon ? '▶' : '◀'}
                          </span>
                        )}
                      </div>

                      {/* User side */}
                      <div className={`${styles.gameSide} ${styles.right}`}>
                        {hasWinner && (
                          <span
                            className={`${styles.resultBadge} ${gameUserWon ? styles.win : styles.loss}`}
                          >
                            {gameUserWon ? 'W' : 'L'}
                          </span>
                        )}
                        {userChar?.selectionValue != null && (
                          <img
                            src={getCharacterStockIcon(userChar.selectionValue)}
                            alt=""
                            className={styles.charIcon}
                          />
                        )}
                        <span className={styles.charName}>{userCharName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
