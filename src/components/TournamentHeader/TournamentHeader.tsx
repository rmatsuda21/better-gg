import { useCallback, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDateRange } from '../../lib/format'
import styles from './TournamentHeader.module.css'

const DESKTOP_MQ = '(min-width: 641px)'

interface TournamentData {
  id?: string | number | null
  name?: string | null
  slug?: string | null
  startAt?: number | null
  endAt?: number | null
  city?: string | null
  addrState?: string | null
  countryCode?: string | null
  isOnline?: boolean | null
  numAttendees?: number | null
  venueAddress?: string | null
  lat?: number | null
  lng?: number | null
  images?: Array<{ url?: string | null } | null> | null
  bannerImages?: Array<{ url?: string | null } | null> | null
}

interface EventData {
  id?: string
  name?: string | null
  videogameName?: string | null
  numEntrants?: number | null
  isOnline?: boolean | null
}

interface TournamentHeaderProps {
  tournament: TournamentData
  event?: EventData
}

export function TournamentHeader({ tournament, event }: TournamentHeaderProps) {
  const profileImage = tournament.images?.[0]?.url
  const bannerImage = tournament.bannerImages?.[0]?.url
  const bannerSrc = bannerImage ?? profileImage

  const location = tournament.isOnline
    ? null
    : [tournament.city, tournament.addrState, tournament.countryCode]
        .filter(Boolean)
        .join(', ')

  const mapsUrl =
    !tournament.isOnline && !event
      ? tournament.venueAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tournament.venueAddress)}`
        : tournament.lat != null && tournament.lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${tournament.lat},${tournament.lng}`
          : location
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
            : null
      : null

  const isOnline = event ? event.isOnline : tournament.isOnline

  const headerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!window.matchMedia(DESKTOP_MQ).matches) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const el = headerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      el.style.setProperty('--px', `${x * 8}px`)
      el.style.setProperty('--py', `${y * 4}px`)
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    const el = headerRef.current
    if (!el) return
    el.style.setProperty('--px', '0px')
    el.style.setProperty('--py', '0px')
  }, [])

  return (
    <div
      className={styles.header}
      ref={headerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.banner}>
        {bannerSrc ? (
          <img className={styles.bannerImage} src={bannerSrc} alt="" />
        ) : (
          <div className={styles.bannerPlaceholder}>
            {(tournament.name ?? '?')[0].toUpperCase()}
          </div>
        )}
        <div className={`${styles.overlayText} ${event ? styles.overlayTextFull : ''}`}>
          {event && tournament.id && (
            <Link
              to="/tournament/$tournamentId"
              params={{ tournamentId: String(tournament.id) }}
              className={styles.tournamentLabel}
            >
              {profileImage && (
                <img
                  className={styles.labelIcon}
                  src={profileImage}
                  alt=""
                />
              )}
              <span className={styles.labelText}>{tournament.name}</span>
            </Link>
          )}
          {event ? (
            event.id ? (
              <Link
                to="/event/$eventId"
                params={{ eventId: event.id }}
                className={styles.eventLink}
              >
                <h2 className={styles.title}>{event.name}</h2>
              </Link>
            ) : (
              <h2 className={styles.title}>{event.name}</h2>
            )
          ) : (
            <h1 className={styles.title}>{tournament.name}</h1>
          )}
        </div>
        {!event && profileImage && bannerImage && (
          <img
            className={styles.iconOverlay}
            src={profileImage}
            alt={tournament.name ?? ''}
          />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {event?.videogameName && <span>{event.videogameName}</span>}
          {tournament.startAt && tournament.endAt && (
            <span>
              {formatDateRange(tournament.startAt, tournament.endAt)}
            </span>
          )}
          {isOnline ? (
            <span className={styles.onlineBadge}>Online</span>
          ) : (
            location && <span>{location}</span>
          )}
          {event
            ? event.numEntrants != null && (
                <span>{event.numEntrants.toLocaleString()} entrants</span>
              )
            : tournament.numAttendees != null && (
                <span>
                  {tournament.numAttendees.toLocaleString()} attendees
                </span>
              )}
        </div>
        {!event && (tournament.slug || mapsUrl) && (
          <div className={styles.links}>
            {tournament.slug && (
              <a
                className={styles.linkPill}
                href={`https://www.start.gg/${tournament.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                start.gg
              </a>
            )}
            {mapsUrl && (
              <a
                className={styles.linkPill}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Maps
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
