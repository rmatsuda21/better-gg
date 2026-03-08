import styles from './StatBlock.module.css'

interface StatBlockProps {
  label: string
  value: string
  loading?: boolean
}

export function StatBlock({ label, value, loading }: StatBlockProps) {
  return (
    <div className={styles.block}>
      <span className={`${styles.value}${loading ? ` ${styles.valueUpdating}` : ''}`}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
