import { Link } from '@tanstack/react-router'
import type { EventDetailsQuery } from '../../gql/graphql'
import { formatDateRange } from '../../lib/format'
import styles from './EventHeader.module.css'

type EventData = NonNullable<EventDetailsQuery['event']>

interface EventHeaderProps {
  event: EventData
  eventId?: string
}

export function EventHeader({ event, eventId }: EventHeaderProps) {
  const tournament = event.tournament
  const profileImage = tournament?.images?.[0]?.url
  const location = [tournament?.city, tournament?.addrState, tournament?.countryCode]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={styles.header}>
      {profileImage ? (
        <img
          className={styles.image}
          src={profileImage}
          alt={tournament?.name ?? ''}
        />
      ) : (
        <div className={styles.imagePlaceholder}>?</div>
      )}
      <div className={styles.info}>
        {tournament && (
          <a
            className={styles.tournamentName}
            href={`https://www.start.gg/${tournament.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tournament.name}
          </a>
        )}
        {eventId ? (
          <Link to="/event/$eventId" params={{ eventId }} search={{ user: undefined }} className={styles.eventNameLink}>
            <h2 className={styles.eventName}>{event.name}</h2>
          </Link>
        ) : (
          <h2 className={styles.eventName}>{event.name}</h2>
        )}
        <div className={styles.meta}>
          {event.videogame?.name && <span>{event.videogame.name}</span>}
          {tournament?.startAt && tournament?.endAt && (
            <span>{formatDateRange(tournament.startAt, tournament.endAt)}</span>
          )}
          {location && <span>{location}</span>}
          {event.numEntrants != null && (
            <span>{event.numEntrants} entrants</span>
          )}
          {event.isOnline && <span className={styles.onlineBadge}>Online</span>}
        </div>
      </div>
    </div>
  )
}
