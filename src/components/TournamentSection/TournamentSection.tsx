import type { Tournament } from '../../lib/tournament-utils'
import { TournamentCard } from '../TournamentCard/TournamentCard'
import styles from './TournamentSection.module.css'

interface TournamentSectionProps {
  title: string
  count: number
  tournaments: Tournament[]
  status: 'upcoming' | 'current' | 'past'
  userDiscriminator: string
}

export function TournamentSection({
  title,
  count,
  tournaments,
  status,
  userDiscriminator,
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
            userDiscriminator={userDiscriminator}
          />
        ))}
      </div>
    </section>
  )
}
