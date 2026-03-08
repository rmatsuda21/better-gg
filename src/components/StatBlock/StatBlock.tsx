import styles from './StatBlock.module.css'

interface StatBlockProps {
  label: string
  value: string
}

export function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div className={styles.block}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
