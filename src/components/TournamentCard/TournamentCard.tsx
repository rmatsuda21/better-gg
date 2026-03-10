import { Link } from '@tanstack/react-router'
import { formatDateRange } from '../../lib/format'
import styles from './TournamentCard.module.css'

export interface TournamentCardData {
  id?: string | null
  name?: string | null
  slug?: string | null
  startAt?: number | null
  endAt?: number | null
  numAttendees?: number | null
  city?: string | null
  addrState?: string | null
  countryCode?: string | null
  isOnline?: boolean | null
  venueName?: string | null
  images?: Array<{ url?: string | null } | null> | null
  events?: Array<{
    id?: string | null
    name?: string | null
    numEntrants?: number | null
  } | null> | null
}

interface TournamentCardProps {
  tournament: TournamentCardData
  status?: 'upcoming' | 'current' | 'past'
  playerId?: string
}

export function TournamentCard({ tournament, status, playerId }: TournamentCardProps) {
  const profileImage = tournament.images?.[0]?.url
  const location = tournament.isOnline
    ? null
    : [tournament.city, tournament.addrState, tournament.countryCode]
        .filter(Boolean)
        .join(', ')

  const accentClass =
    status === 'current'
      ? styles.accentCurrent
      : status === 'upcoming'
        ? styles.accentUpcoming
        : styles.accentPast

  return (
    <div className={`${styles.card} ${accentClass}`}>
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
                event &&
                event.id && (
                  playerId ? (
                    <Link
                      key={event.id}
                      to="/player/$playerId/event/$eventId"
                      params={{ playerId, eventId: String(event.id) }}
                      className={styles.eventPill}
                    >
                      {event.name}
                      {event.numEntrants != null && ` (${event.numEntrants})`}
                    </Link>
                  ) : (
                    <Link
                      key={event.id}
                      to="/event/$eventId"
                      params={{ eventId: String(event.id) }}
                      className={styles.eventPill}
                    >
                      {event.name}
                      {event.numEntrants != null && ` (${event.numEntrants})`}
                    </Link>
                  )
                ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
