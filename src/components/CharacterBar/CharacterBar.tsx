import type { CharacterUsage } from '../../lib/stats-utils'
import styles from './CharacterBar.module.css'

const COLORS = ['#646cff', '#4ade80', '#ff6b6b', '#f59e0b', '#a78bfa', '#f472b6', '#34d399']

interface CharacterBarProps {
  usage: CharacterUsage[]
  characterMap: Map<number, string>
}

export function CharacterBar({ usage, characterMap }: CharacterBarProps) {
  if (usage.length === 0) {
    return <p className={styles.empty}>No character data available</p>
  }

  return (
    <div className={styles.container}>
      <div className={styles.bar}>
        {usage.map((u, i) => (
          <div
            key={u.characterId}
            className={styles.segment}
            style={{
              width: `${u.percentage * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${characterMap.get(u.characterId) ?? `#${u.characterId}`}: ${Math.round(u.percentage * 100)}%`}
          />
        ))}
      </div>
      <div className={styles.legend}>
        {usage.map((u, i) => (
          <div key={u.characterId} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className={styles.legendName}>
              {characterMap.get(u.characterId) ?? `#${u.characterId}`}
            </span>
            <span className={styles.legendPct}>
              {Math.round(u.percentage * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
