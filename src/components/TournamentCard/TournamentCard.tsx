import type { UserTournamentsQuery } from '../../gql/graphql'
import { formatDateRange } from '../../lib/format'
import styles from './TournamentCard.module.css'

type TournamentNode = NonNullable<
  NonNullable<
    NonNullable<UserTournamentsQuery['user']>['tournaments']
  >['nodes']
>[number]

interface TournamentCardProps {
  tournament: NonNullable<TournamentNode>
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const profileImage = tournament.images?.[0]?.url
  const location = tournament.isOnline
    ? null
    : [tournament.city, tournament.addrState, tournament.countryCode]
        .filter(Boolean)
        .join(', ')

  return (
    <div className={styles.card}>
      {profileImage ? (
        <img
          className={styles.image}
          src={profileImage}
          alt={tournament.name ?? ''}
        />
      ) : (
        <div className={styles.imagePlaceholder}>?</div>
      )}
      <div className={styles.info}>
        <a
          className={styles.name}
          href={`https://www.start.gg/${tournament.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {tournament.name}
        </a>
        <div className={styles.meta}>
          {tournament.startAt && tournament.endAt && (
            <span>{formatDateRange(tournament.startAt, tournament.endAt)}</span>
          )}
          {tournament.isOnline ? (
            <span className={styles.onlineBadge}>Online</span>
          ) : (
            location && <span>{location}</span>
          )}
          {tournament.numAttendees != null && (
            <span>{tournament.numAttendees} attendees</span>
          )}
        </div>
        {tournament.events && tournament.events.length > 0 && (
          <div className={styles.events}>
            {tournament.events.map(
              (event) =>
                event && (
                  <span key={event.id} className={styles.eventPill}>
                    {event.name}
                    {event.numEntrants != null && ` (${event.numEntrants})`}
                  </span>
                )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
