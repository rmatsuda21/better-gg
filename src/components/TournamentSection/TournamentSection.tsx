import type { TournamentCardData } from '../TournamentCard/TournamentCard'
import { TournamentCard } from '../TournamentCard/TournamentCard'
import styles from './TournamentSection.module.css'

interface TournamentSectionProps {
  title: string
  count: number
  tournaments: TournamentCardData[]
  status: 'upcoming' | 'current' | 'past'
  playerId?: string
}

export function TournamentSection({
  title,
  count,
  tournaments,
  status,
  playerId,
}: TournamentSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.count}>{count}</span>
      </div>
      <div className={styles.list}>
        {tournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            status={status}
            playerId={playerId}
          />
        ))}
      </div>
    </section>
  )
}
