import { formatPlacement } from '../../lib/format'
import styles from './PlacementList.module.css'

interface PlacementEntry {
  placement: number
  eventName: string
  tournamentName: string
  numEntrants?: number | null
}

interface PlacementListProps {
  placements: PlacementEntry[]
}

export function PlacementList({ placements }: PlacementListProps) {
  if (placements.length === 0) {
    return <p className={styles.empty}>No recent placements</p>
  }

  return (
    <div className={styles.list}>
      {placements.map((p, i) => (
        <div key={i} className={styles.item}>
          <span className={styles.placement}>{formatPlacement(p.placement)}</span>
          <div className={styles.eventInfo}>
            <span className={styles.eventName}>{p.eventName}</span>
            <span className={styles.tournamentName}>{p.tournamentName}</span>
          </div>
          {p.numEntrants != null && (
            <span className={styles.entrants}>/ {p.numEntrants}</span>
          )}
        </div>
      ))}
    </div>
  )
}
