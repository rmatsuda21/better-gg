import { DataTable, DataTableHeader, DataTableRow } from '../DataTable/DataTable'
import styles from './PoolLoadingState.module.css'

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
