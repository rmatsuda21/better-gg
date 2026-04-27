import type { CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDateRange } from '../../lib/format'
import { getTournamentLiveness } from '../../lib/tournament-utils'
import { LAYOUT } from '../../lib/constants'
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
  bannerImages?: Array<{ url?: string | null } | null> | null
  events?: Array<{
    id?: string | null
    name?: string | null
    numEntrants?: number | null
  } | null> | null
}

interface TournamentCardProps {
  tournament: TournamentCardData
  variant?: 'compact' | 'grid'
  status?: 'upcoming' | 'current' | 'past'
  playerId?: string
  className?: string
  style?: CSSProperties
}

const MAX_VISIBLE_EVENTS = LAYOUT.MAX_VISIBLE_EVENTS

function EventPills({
  events,
  playerId,
  variant,
}: {
  events: TournamentCardData['events']
  playerId?: string
  variant: 'compact' | 'grid'
}) {
  const validEvents = events?.filter((e): e is NonNullable<typeof e> => !!e?.id) ?? []
  if (validEvents.length === 0) return null

  const visible = variant === 'grid' ? validEvents.slice(0, MAX_VISIBLE_EVENTS) : validEvents
  const overflow = variant === 'grid' ? validEvents.length - MAX_VISIBLE_EVENTS : 0

  return (
    <div className={variant === 'grid' ? styles.eventsGrid : styles.events}>
      {visible.map((event) =>
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
        ),
      )}
      {overflow > 0 && (
        <span className={styles.eventOverflow}>+{overflow} more</span>
      )}
    </div>
  )
}

export function TournamentCard({
  tournament,
  variant = 'compact',
  status,
  playerId,
  className,
  style,
}: TournamentCardProps) {
  const profileImage = tournament.images?.[0]?.url
  const bannerImage = tournament.bannerImages?.[0]?.url
  const location = tournament.isOnline
    ? null
    : [tournament.city, tournament.addrState, tournament.countryCode]
        .filter(Boolean)
        .join(', ')

  const liveness = getTournamentLiveness(tournament.startAt, tournament.endAt)

  const accentClass =
    status === 'current'
      ? styles.accentCurrent
      : status === 'upcoming'
        ? styles.accentUpcoming
        : styles.accentPast

  const livenessClass = liveness?.kind === 'live' ? styles.cardLive : liveness?.kind === 'soon' ? styles.cardSoon : ''

  if (variant === 'grid') {
    const initial = (tournament.name ?? '?')[0].toUpperCase()
    const gridBanner = bannerImage ?? profileImage

    return (
      <div
        className={`${styles.cardGrid} ${accentClass} ${livenessClass} ${className ?? ''}`}
        style={style}
      >
        <Link
          to="/tournament/$tournamentId"
          params={{ tournamentId: String(tournament.id) }}
          className={styles.imageWrap}
        >
          {gridBanner ? (
            <img
              className={styles.imageGrid}
              src={gridBanner}
              alt={tournament.name ?? ''}
            />
          ) : (
            <div className={styles.imagePlaceholderGrid}>{initial}</div>
          )}
          {profileImage && bannerImage && (
            <img
              className={styles.iconOverlay}
              src={profileImage}
              alt=""
            />
          )}
          {liveness && (
            <span className={`${styles.livenessBadge} ${liveness.kind === 'live' ? styles.livenessBadgeLive : styles.livenessBadgeSoon}`}>
              {liveness.label}
            </span>
          )}
          <span className={styles.nameOverlay}>
            {tournament.name}
          </span>
        </Link>
        <div className={styles.bodyGrid}>
          <div className={styles.metaLine}>
            {tournament.startAt && tournament.endAt && (
              <span>{formatDateRange(tournament.startAt, tournament.endAt)}</span>
            )}
            {tournament.isOnline ? (
              <span className={styles.onlineBadge}>Online</span>
            ) : (
              location && <span>{location}</span>
            )}
            {tournament.numAttendees != null && (
              <span>{tournament.numAttendees.toLocaleString()} entrants</span>
            )}
          </div>
          <EventPills events={tournament.events} playerId={playerId} variant="grid" />
        </div>
      </div>
    )
  }

  // Compact variant (default) — original horizontal layout
  return (
    <div
      className={`${styles.card} ${accentClass} ${livenessClass} ${className ?? ''}`}
      style={style}
    >
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
        <div className={styles.nameRow}>
          <Link
            to="/tournament/$tournamentId"
            params={{ tournamentId: String(tournament.id) }}
            className={styles.name}
          >
            {tournament.name}
          </Link>
          {liveness && (
            <span className={`${styles.livenessPill} ${liveness.kind === 'live' ? styles.livenessPillLive : styles.livenessPillSoon}`}>
              {liveness.label}
            </span>
          )}
        </div>
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
        <EventPills events={tournament.events} playerId={playerId} variant="compact" />
      </div>
    </div>
  )
}
