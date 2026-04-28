import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { usePlayerSets } from '../../hooks/use-player-sets'
import { computeRecentRivals } from '../../lib/stats-utils'
import { isSmashGame } from '../../lib/smash-games'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './RecentRivalsCard.module.css'

interface RecentRivalsCardProps {
  playerId: string
}

export function RecentRivalsCard({ playerId }: RecentRivalsCardProps) {
  const setsQuery = usePlayerSets(playerId, 1)

  const rivals = useMemo(() => {
    const firstPage = setsQuery.data?.pages?.[0]
    const nodes = firstPage?.player?.sets?.nodes ?? []
    const validSets = nodes
      .filter((s): s is NonNullable<typeof s> => s != null)
      .filter((s) => isSmashGame(s.event?.videogame?.id))
    return computeRecentRivals(validSets, playerId, 5)
  }, [setsQuery.data?.pages, playerId])

  const isLoading = setsQuery.isLoading && !setsQuery.data
  const isEmpty = !isLoading && rivals.length === 0

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Rivals</h3>
      </div>

      {isLoading ? (
        <div className={styles.list}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} width="100%" height={36} borderRadius={6} />
          ))}
        </div>
      ) : isEmpty ? (
        <p className={styles.empty}>No recent matchups yet.</p>
      ) : (
        <div className={styles.list}>
          {rivals.map((r) => {
            const recordKind =
              r.wins > r.losses ? styles.recordWin : r.losses > r.wins ? styles.recordLoss : styles.recordEven
            const inner = (
              <>
                <span className={styles.opponentName}>{r.opponentName}</span>
                <span className={styles.encounters}>{r.encounters}×</span>
                <span className={`${styles.record} ${recordKind}`}>
                  {r.wins}-{r.losses}
                </span>
              </>
            )

            return r.opponentPlayerId ? (
              <Link
                key={r.opponentPlayerId}
                to="/player/$playerId"
                params={{ playerId: r.opponentPlayerId }}
                className={styles.row}
              >
                {inner}
              </Link>
            ) : (
              <div key={r.opponentEntrantId} className={`${styles.row} ${styles.rowStatic}`}>
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
