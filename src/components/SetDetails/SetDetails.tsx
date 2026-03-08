import { Link } from '@tanstack/react-router'
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
): { left: string; right: string } | null {
  if (!displayScore) return null
  // displayScore(mainEntrantId) puts main entrant first: "3 - 1"
  const parts = displayScore.split(' - ')
  if (parts.length !== 2) return null
  return { left: parts[0].trim(), right: parts[1].trim() }
}

export function SetDetails({
  sets,
  userEntrantId,
  characterMap,
}: SetDetailsProps) {
  if (sets.length === 0) {
    return <p className={styles.empty}>No set results available</p>
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
        // displayScore(mainEntrantId) → "userScore - oppScore"
        const userScore = scores?.left
        const oppScore = scores?.right

        const userIsWinner = set.winnerId === userEntrantNumId
        const oppIsWinner = set.winnerId != null && !userIsWinner

        const gamesWithSelections = (set.games ?? []).filter(
          (g): g is NonNullable<typeof g> =>
            g != null &&
            (g.selections ?? []).some((s) => s?.selectionType === 'CHARACTER'),
        )

        return (
          <div key={set.id} className={styles.setCard}>
            {/* Set header: Opp | scores + round | User */}
            <div className={styles.setHeader}>
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
            {gamesWithSelections.length > 0 && (
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
