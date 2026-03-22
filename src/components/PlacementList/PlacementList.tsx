import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatPlacement } from '../../lib/format'
import styles from './PlacementList.module.css'

export interface PlacementEntry {
  placement: number
  eventName: string
  tournamentName: string
  numEntrants?: number | null
  eventId?: string | null
  playerId?: string | null
}

interface PlacementListProps {
  placements: PlacementEntry[]
  isLoadingMore?: boolean
}

export function PlacementList({ placements, isLoadingMore }: PlacementListProps) {
  const [prevLength, setPrevLength] = useState(0)
  const [trackedLength, setTrackedLength] = useState(placements.length)
  if (trackedLength !== placements.length) {
    setPrevLength(trackedLength)
    setTrackedLength(placements.length)
  }
  const animateOffset = prevLength

  if (placements.length === 0 && !isLoadingMore) {
    return <p className={styles.empty}>No recent placements</p>
  }

  return (
    <div className={styles.list}>
      {placements.map((p, i) => {
        const isNew = i >= animateOffset
        return (
          <div
            key={p.eventId ?? i}
            className={`${styles.item} ${isNew ? styles.itemAnimated : ''}`}
            style={isNew ? { animationDelay: `${(i - animateOffset) * 40}ms` } : undefined}
          >
            <span className={`${styles.placement} ${p.placement === 1 ? styles.placementGold : p.placement === 2 ? styles.placementSilver : p.placement === 3 ? styles.placementBronze : ''}`}>{formatPlacement(p.placement)}</span>
            <div className={styles.eventInfo}>
              <span className={styles.eventName}>{p.eventName}</span>
              {p.eventId && p.playerId ? (
                <Link
                  to="/player/$playerId/event/$eventId"
                  params={{ playerId: p.playerId, eventId: p.eventId }}
                  className={styles.tournamentLink}
                >
                  {p.tournamentName}
                </Link>
              ) : (
                <span className={styles.tournamentName}>{p.tournamentName}</span>
              )}
            </div>
            {p.numEntrants != null && (
              <span className={styles.entrants}>/ {p.numEntrants}</span>
            )}
          </div>
        )
      })}
      {isLoadingMore && (
        <div className={styles.loadingMore}>
          <div className={styles.spinner} />
          Loading more events...
        </div>
      )}
    </div>
  )
}
