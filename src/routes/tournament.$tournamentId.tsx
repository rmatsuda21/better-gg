import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTournamentDetails } from '../hooks/use-tournament-details'
import { useTournamentParticipants } from '../hooks/use-tournament-participants'
import { useAllEventStandings } from '../hooks/use-event-standings'
import { useEventEntrantSearch } from '../hooks/use-event-entrant-search'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import {
  ParticipantList,
} from '../components/ParticipantList/ParticipantList'
import type { EventInfo } from '../components/ParticipantList/ParticipantList'
import type { EventStanding } from '../hooks/use-event-standings'
import { formatDateRange, formatPlacement } from '../lib/format'
import type { TournamentDetailsQuery } from '../gql/graphql'
import styles from './tournament.$tournamentId.module.css'

export const Route = createFileRoute('/tournament/$tournamentId')({
  component: TournamentPage,
})

type EventData = NonNullable<
  NonNullable<TournamentDetailsQuery['tournament']>['events']
>[number]

function TournamentPage() {
  const { tournamentId } = Route.useParams()
  const { data, isLoading, isError, error, refetch } =
    useTournamentDetails(tournamentId)
  const {
    data: participants,
    isLoading: participantsLoading,
  } = useTournamentParticipants(tournamentId)

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Skeleton width="100%" height={120} borderRadius={8} />
        <Skeleton width="100%" height={200} borderRadius={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={
          error instanceof Error ? error.message : 'Failed to load tournament'
        }
        onRetry={() => refetch()}
      />
    )
  }

  const tournament = data?.tournament
  if (!tournament) {
    return <ErrorMessage message="Tournament not found" />
  }

  const profileImage = tournament.images?.[0]?.url
  const location = tournament.isOnline
    ? null
    : [tournament.city, tournament.addrState, tournament.countryCode]
        .filter(Boolean)
        .join(', ')

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        &larr; Home
      </Link>

      <div className={styles.header}>
        {profileImage ? (
          <img
            className={styles.headerImage}
            src={profileImage}
            alt={tournament.name ?? ''}
          />
        ) : (
          <div className={styles.headerImagePlaceholder}>?</div>
        )}
        <div className={styles.headerInfo}>
          <h1 className={styles.tournamentName}>{tournament.name}</h1>
          <div className={styles.headerMeta}>
            {tournament.startAt && tournament.endAt && (
              <span>
                {formatDateRange(tournament.startAt, tournament.endAt)}
              </span>
            )}
            {tournament.isOnline ? (
              <span className={styles.onlineBadge}>Online</span>
            ) : (
              location && <span>{location}</span>
            )}
            {tournament.venueName && <span>{tournament.venueName}</span>}
            {tournament.numAttendees != null && (
              <span>{tournament.numAttendees} attendees</span>
            )}
          </div>
          {tournament.slug && (
            <a
              className={styles.externalLink}
              href={`https://www.start.gg/${tournament.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on start.gg &rarr;
            </a>
          )}
        </div>
      </div>

      <PlayersSection
        tournament={tournament}
        participants={participants ?? []}
        isLoading={participantsLoading}
      />

      {tournament.events && tournament.events.length > 0 && (
        <div className={styles.eventsSection}>
          <h3 className={styles.sectionTitle}>Events</h3>
          {tournament.events.map(
            (event, i) =>
              event && (
                <EventCard
                  key={event.id}
                  event={event}
                  stagger={i}
                />
              ),
          )}
        </div>
      )}
    </div>
  )
}

function PlayersSection({
  tournament,
  participants,
  isLoading,
}: {
  tournament: NonNullable<TournamentDetailsQuery['tournament']>
  participants: import('../hooks/use-tournament-participants').TournamentParticipant[]
  isLoading: boolean
}) {
  const eventInfos: EventInfo[] = useMemo(
    () =>
      (tournament.events ?? [])
        .filter((e): e is NonNullable<typeof e> => !!e?.id)
        .map((e) => ({
          id: String(e.id),
          name: e.name ?? 'Event',
          phases: (e.phases ?? [])
            .filter((p): p is NonNullable<typeof p> => !!p?.id)
            .map((p) => ({
              id: String(p.id),
              phaseOrder: p.phaseOrder ?? null,
            })),
        })),
    [tournament.events],
  )

  return (
    <div className={styles.playerSection}>
      <div className={styles.playerSectionHeader}>
        <h3 className={styles.sectionTitle}>Players</h3>
        {!isLoading && participants.length > 0 && (
          <span className={styles.countBadge}>
            {participants.length.toLocaleString()}
          </span>
        )}
      </div>
      <ParticipantList
        participants={participants}
        events={eventInfos}
        isLoading={isLoading}
      />
    </div>
  )
}

function EventCard({
  event,
  stagger,
}: {
  event: NonNullable<EventData>
  stagger: number
}) {
  const [showStandings, setShowStandings] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const eventId = String(event.id ?? '')

  const { data: standings, isLoading: standingsLoading } =
    useAllEventStandings(eventId, showStandings && !debouncedSearch)

  const { data: searchData, isLoading: searchLoading } =
    useEventEntrantSearch(eventId, debouncedSearch, showStandings && debouncedSearch.length >= 2)

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
  }, [])

  const stateClass =
    event.state === 'ACTIVE'
      ? styles.stateActive
      : event.state === 'COMPLETED'
        ? styles.stateCompleted
        : styles.stateCreated

  const isSearchMode = debouncedSearch.length >= 2

  return (
    <div
      className={`${styles.eventCard} ${stateClass}`}
      style={{ '--stagger': stagger } as React.CSSProperties}
    >
      <div className={styles.eventCardHeader}>
        <div>
          <h4 className={styles.eventName}>{event.name}</h4>
          <div className={styles.eventMeta}>
            {event.videogame?.name && (
              <span className={styles.badge}>{event.videogame.name}</span>
            )}
            {event.state && (
              <span
                className={`${styles.stateBadge} ${
                  event.state === 'ACTIVE'
                    ? styles.active
                    : event.state === 'COMPLETED'
                      ? styles.completed
                      : ''
                }`}
              >
                {event.state}
              </span>
            )}
            {event.numEntrants != null && (
              <span className={styles.entrantCount}>
                {event.numEntrants} entrants
              </span>
            )}
          </div>
        </div>
      </div>

      {event.phases && event.phases.length > 0 && (
        <div className={styles.phaseList}>
          {event.phases.map(
            (phase) =>
              phase && (
                <Link
                  key={phase.id}
                  to="/event/$eventId/phase/$phaseId"
                  params={{ eventId, phaseId: String(phase.id) }}
                  className={styles.phaseLink}
                >
                  <span className={styles.phaseName}>{phase.name}</span>
                  <span className={styles.phaseMeta}>
                    {phase.numSeeds != null && (
                      <span className={styles.phaseSeeds}>
                        {phase.numSeeds}
                      </span>
                    )}
                    {phase.bracketType && (
                      <span className={styles.bracketType}>
                        {phase.bracketType}
                      </span>
                    )}
                    {phase.state && (
                      <span
                        className={`${styles.phaseState} ${
                          phase.state === 'ACTIVE'
                            ? styles.phaseActive
                            : phase.state === 'COMPLETED'
                              ? styles.phaseCompleted
                              : ''
                        }`}
                      >
                        {phase.state}
                      </span>
                    )}
                  </span>
                </Link>
              ),
          )}
        </div>
      )}

      <button
        className={styles.standingsToggle}
        onClick={() => setShowStandings(!showStandings)}
      >
        <span className={`${styles.toggleArrow} ${showStandings ? styles.open : ''}`}>
          &#9654;
        </span>
        {showStandings ? 'Hide standings' : 'Show standings'}
      </button>

      {showStandings && (
        <div className={styles.standingsSection}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />

          {isSearchMode ? (
            <SearchResults data={searchData} isLoading={searchLoading} />
          ) : (
            <VirtualizedStandings
              standings={standings ?? []}
              isLoading={standingsLoading}
            />
          )}
        </div>
      )}
    </div>
  )
}

function StandingsRow({
  placement,
  seed,
  name,
  prefix,
  playerId,
}: {
  placement?: number | null
  seed?: number | null
  name?: string | null
  prefix?: string | null
  playerId?: string | null
}) {
  return (
    <div className={styles.standingsRow}>
      <span className={styles.placement}>
        {placement != null ? formatPlacement(placement) : '-'}
      </span>
      <span className={styles.seed}>{seed != null ? seed : '-'}</span>
      <span className={styles.entrantName}>
        {playerId ? (
          <Link
            to="/player/$playerId"
            params={{ playerId }}
            className={styles.entrantLink}
          >
            {prefix && <span className={styles.prefix}>{prefix}</span>}
            {name}
          </Link>
        ) : (
          <>
            {prefix && <span className={styles.prefix}>{prefix}</span>}
            {name}
          </>
        )}
      </span>
    </div>
  )
}

function SearchResults({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useEventEntrantSearch>['data']
  isLoading: boolean
}) {
  const entrants = data?.event?.entrants?.nodes

  if (isLoading) {
    return <Skeleton width="100%" height={150} borderRadius={6} />
  }

  if (!entrants || entrants.length === 0) {
    return <p className={styles.noResults}>No players found</p>
  }

  return (
    <div className={styles.standingsTable}>
      <div className={styles.standingsRowHeader}>
        <span>Place</span>
        <span>Seed</span>
        <span>Player</span>
      </div>
      {entrants.map(
        (entrant) =>
          entrant && (
            <StandingsRow
              key={entrant.id}
              placement={entrant.standing?.placement}
              seed={entrant.initialSeedNum}
              name={entrant.name}
              prefix={entrant.participants?.[0]?.prefix}
              playerId={entrant.participants?.[0]?.player?.id ? String(entrant.participants[0].player.id) : null}
            />
          ),
      )}
    </div>
  )
}

const STANDINGS_ROW_HEIGHT = 36

function VirtualizedStandings({
  standings,
  isLoading,
}: {
  standings: EventStanding[]
  isLoading: boolean
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: standings.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => STANDINGS_ROW_HEIGHT,
    overscan: 20,
  })

  if (isLoading) {
    return <Skeleton width="100%" height={150} borderRadius={6} />
  }

  if (standings.length === 0) {
    return <p className={styles.noResults}>No standings available</p>
  }

  return (
    <>
      <div className={styles.standingsHeader}>
        <span className={styles.countBadge}>
          {standings.length.toLocaleString()} entrants
        </span>
      </div>
      <div className={styles.standingsTable}>
        <div className={styles.standingsRowHeader}>
          <span>Place</span>
          <span>Seed</span>
          <span>Player</span>
        </div>
        <div ref={parentRef} className={styles.standingsScrollContainer}>
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <StandingsRow
                  placement={standings[virtualRow.index].placement}
                  seed={standings[virtualRow.index].seed}
                  name={standings[virtualRow.index].name}
                  prefix={standings[virtualRow.index].prefix}
                  playerId={standings[virtualRow.index].playerId}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
