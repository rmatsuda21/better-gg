import styles from './FilterToggle.module.css'

export type OnlineFilter = 'all' | 'offline' | 'online'

const options: { value: OnlineFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
]

interface FilterToggleProps {
  value: OnlineFilter
  onChange: (value: OnlineFilter) => void
}

export function FilterToggle({ value, onChange }: FilterToggleProps) {
  return (
    <div className={styles.toggle}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.option} ${value === opt.value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
