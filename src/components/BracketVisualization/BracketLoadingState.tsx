import styles from './BracketLoadingState.module.css'

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
