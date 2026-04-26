import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useElementScrollRestoration } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { formatPlacement } from '../../lib/format'
import type { TournamentParticipant } from '../../hooks/use-tournament-participants'
import type { EventStanding } from '../../hooks/use-event-standings'
import { Skeleton } from '../Skeleton/Skeleton'
import { DataTable, DataTableHeader, DataTableRow } from '../DataTable/DataTable'
import styles from './ParticipantList.module.css'

const ROW_HEIGHT = 44

export interface EventInfo {
  id: string
  name: string
  isTeamEvent: boolean
  phases: Array<{ id: string; phaseOrder: number | null }>
}

export type ParticipantViewMode =
  | { kind: 'all' }
  | { kind: 'event'; eventId: string }

interface ProcessedParticipant {
  participant: TournamentParticipant
  displaySeed: number | null
}

interface ParticipantListProps {
  participants: TournamentParticipant[]
  events: EventInfo[]
  isLoading: boolean
  viewMode?: ParticipantViewMode
  teamEntrants?: EventStanding[]
  teamEntrantsLoading?: boolean
}

export function ParticipantList({
  participants,
  events,
  isLoading,
  viewMode = { kind: 'all' },
  teamEntrants,
  teamEntrantsLoading,
}: ParticipantListProps) {
  'use no memo'
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 200)
  const parentRef = useRef<HTMLDivElement>(null)

  const isTeamMode = viewMode.kind === 'event'
    && events.find(e => e.id === viewMode.eventId)?.isTeamEvent === true
  const showSeed = viewMode.kind === 'event'

  // Reset scroll and search when viewMode changes
  const viewModeKey = viewMode.kind === 'event' ? viewMode.eventId : 'all'
  useEffect(() => {
    setSearchInput('')
    parentRef.current?.scrollTo({ top: 0 })
  }, [viewModeKey])

  // Map eventId → first phase ID (sorted by phaseOrder)
  const eventPhaseMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) {
      if (event.phases.length > 0) {
        const sorted = [...event.phases].sort(
          (a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0),
        )
        map.set(event.id, sorted[0].id)
      }
    }
    return map
  }, [events])

  // Map eventId → event name
  const eventNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events) {
      map.set(event.id, event.name)
    }
    return map
  }, [events])

  // Process participants based on view mode (non-team)
  const processedParticipants = useMemo((): ProcessedParticipant[] => {
    if (isTeamMode) return []
    if (viewMode.kind === 'all') {
      // All mode: alphabetical by gamerTag, no seed
      const sorted = [...participants].sort((a, b) =>
        a.gamerTag.localeCompare(b.gamerTag, undefined, { sensitivity: 'base' }),
      )
      return sorted.map((p) => ({ participant: p, displaySeed: null }))
    }

    // Event mode: filter to participants in this event, sort by seed
    const eventId = viewMode.eventId
    const result: ProcessedParticipant[] = []
    for (const p of participants) {
      const entrant = p.entrants.find((e) => e.eventId === eventId)
      if (entrant) {
        result.push({ participant: p, displaySeed: entrant.seed })
      }
    }
    result.sort((a, b) => {
      if (a.displaySeed == null && b.displaySeed == null) return 0
      if (a.displaySeed == null) return 1
      if (b.displaySeed == null) return -1
      return a.displaySeed - b.displaySeed
    })
    return result
  }, [participants, viewMode, isTeamMode])

  // Filter team entrants by search (matches team name or any member's gamerTag/prefix)
  const filteredTeams = useMemo(() => {
    if (!isTeamMode || !teamEntrants) return []
    if (!debouncedSearch) return teamEntrants
    const q = debouncedSearch.toLowerCase()
    return teamEntrants.filter((t) => {
      if (t.name?.toLowerCase().includes(q)) return true
      return t.participants.some(
        p => p.gamerTag.toLowerCase().includes(q)
          || (p.prefix && p.prefix.toLowerCase().includes(q)),
      )
    })
  }, [isTeamMode, teamEntrants, debouncedSearch])

  // Filter participants by search (non-team)
  const filteredParticipants = useMemo(() => {
    if (isTeamMode) return []
    if (!debouncedSearch) return processedParticipants
    const q = debouncedSearch.toLowerCase()
    return processedParticipants.filter((item) => {
      if (item.participant.gamerTag.toLowerCase().includes(q)) return true
      if (item.participant.prefix && item.participant.prefix.toLowerCase().includes(q)) return true
      return false
    })
  }, [isTeamMode, processedParticipants, debouncedSearch])

  const itemCount = isTeamMode ? filteredTeams.length : filteredParticipants.length

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  // Element scroll restoration for back/forward navigation
  const scrollEntry = useElementScrollRestoration({ id: 'participant-list' })
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (hasRestoredRef.current || !scrollEntry?.scrollY || itemCount === 0) return
    hasRestoredRef.current = true
    requestAnimationFrame(() => {
      parentRef.current?.scrollTo({ top: scrollEntry.scrollY })
    })
  }, [scrollEntry, itemCount])

  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo({ top: 0 })
  }, [])

  const effectiveLoading = isTeamMode ? (teamEntrantsLoading ?? true) : isLoading

  if (effectiveLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="100%" height={44} borderRadius={6} />
        ))}
      </div>
    )
  }

  const selectedEventId = viewMode.kind === 'event' ? viewMode.eventId : null

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={isTeamMode ? 'Search teams...' : 'Search players...'}
        value={searchInput}
        onChange={(e) => {
          setSearchInput(e.target.value)
          scrollToTop()
        }}
      />

      <DataTable>
        <DataTableHeader className={showSeed ? styles.columns : styles.columnsNoSeed}>
          {showSeed && <span>Seed</span>}
          <span>{isTeamMode ? 'Team' : 'Player'}</span>
          {isTeamMode ? <span>Place</span> : <span>Events</span>}
        </DataTableHeader>
        {itemCount === 0 ? (
          <div className={styles.noResults}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            No {isTeamMode ? 'teams' : 'players'} found
          </div>
        ) : (
          <>
          <div ref={parentRef} className={styles.scrollContainer} data-scroll-restoration-id="participant-list">
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
                  {isTeamMode ? (
                    <TeamRow
                      team={filteredTeams[virtualRow.index]}
                      eventId={selectedEventId!}
                      phaseId={eventPhaseMap.get(selectedEventId!) ?? null}
                    />
                  ) : (
                    <ParticipantRow
                      participant={filteredParticipants[virtualRow.index].participant}
                      displaySeed={filteredParticipants[virtualRow.index].displaySeed}
                      showSeed={showSeed}
                      eventPhaseMap={eventPhaseMap}
                      eventNameMap={eventNameMap}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          </>
        )}
      </DataTable>
    </div>
  )
}

function ParticipantRow({
  participant,
  displaySeed,
  showSeed,
  eventPhaseMap,
  eventNameMap,
}: {
  participant: TournamentParticipant
  displaySeed: number | null
  showSeed: boolean
  eventPhaseMap: Map<string, string>
  eventNameMap: Map<string, string>
}) {
  return (
    <DataTableRow className={showSeed ? styles.rowColumns : styles.rowColumnsNoSeed}>
      {showSeed && (
        <div className={styles.seed}>
          {displaySeed ?? '-'}
        </div>
      )}
      <div className={styles.playerInfo}>
        {participant.playerId ? (
          <Link
            to="/player/$playerId"
            params={{ playerId: participant.playerId }}
            className={styles.playerLink}
          >
            {participant.prefix && (
              <span className={styles.prefix}>{participant.prefix}</span>
            )}
            {participant.gamerTag}
          </Link>
        ) : (
          <span className={styles.playerLink}>
            {participant.prefix && (
              <span className={styles.prefix}>{participant.prefix}</span>
            )}
            {participant.gamerTag}
          </span>
        )}
      </div>
      <div className={styles.eventBadges}>
        {participant.entrants.map((entrant) => {
          const phaseId = eventPhaseMap.get(entrant.eventId)
          const eventName = eventNameMap.get(entrant.eventId) ?? 'Event'

          if (phaseId) {
            return (
              <Link
                key={entrant.entrantId}
                to="/event/$eventId/phase/$phaseId"
                params={{ eventId: entrant.eventId, phaseId }}
                search={{ entrantId: entrant.entrantId }}
                className={styles.eventBadge}
              >
                <span className={styles.eventName}>{eventName}</span>
                {entrant.placement != null && (
                  <span className={styles.placementText}>
                    {formatPlacement(entrant.placement)}
                  </span>
                )}
              </Link>
            )
          }

          return (
            <Link
              key={entrant.entrantId}
              to="/event/$eventId"
              params={{ eventId: entrant.eventId }}
              className={styles.eventBadge}
            >
              <span className={styles.eventName}>{eventName}</span>
              {entrant.placement != null && (
                <span className={styles.placementText}>
                  {formatPlacement(entrant.placement)}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </DataTableRow>
  )
}

function TeamRow({
  team,
  eventId,
  phaseId,
}: {
  team: EventStanding
  eventId: string
  phaseId: string | null
}) {
  return (
    <DataTableRow className={styles.rowColumns}>
      <div className={styles.seed}>
        {team.seed ?? '-'}
      </div>
      <div className={styles.teamMembers}>
        {team.participants.length > 0 ? (
          team.participants.map((p, i) => (
            <span key={p.playerId ?? i} className={styles.teamMember}>
              {i > 0 && <span className={styles.teamSeparator}>/</span>}
              {p.playerId ? (
                <Link
                  to="/player/$playerId"
                  params={{ playerId: p.playerId }}
                  className={styles.playerLink}
                >
                  {p.prefix && <span className={styles.prefix}>{p.prefix}</span>}
                  {p.gamerTag}
                </Link>
              ) : (
                <span className={styles.playerLink}>
                  {p.prefix && <span className={styles.prefix}>{p.prefix}</span>}
                  {p.gamerTag}
                </span>
              )}
            </span>
          ))
        ) : (
          <span className={styles.playerLink}>{team.name ?? 'Unknown'}</span>
        )}
      </div>
      <div className={styles.eventBadges}>
        {team.placement != null && (
          phaseId ? (
            <Link
              to="/event/$eventId/phase/$phaseId"
              params={{ eventId, phaseId }}
              className={styles.eventBadge}
            >
              <span className={styles.placementText}>
                {formatPlacement(team.placement)}
              </span>
            </Link>
          ) : (
            <span className={styles.eventBadge}>
              <span className={styles.placementText}>
                {formatPlacement(team.placement)}
              </span>
            </span>
          )
        )}
      </div>
    </DataTableRow>
  )
}
