import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useElementScrollRestoration } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { formatPlacement } from '../../lib/format'
import type { TournamentParticipant } from '../../hooks/use-tournament-participants'
import { Skeleton } from '../Skeleton/Skeleton'
import { DataTable, DataTableHeader, DataTableRow } from '../DataTable/DataTable'
import styles from './ParticipantList.module.css'

const ROW_HEIGHT = 44

export interface EventInfo {
  id: string
  name: string
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
}

export function ParticipantList({
  participants,
  events,
  isLoading,
  viewMode = { kind: 'all' },
}: ParticipantListProps) {
  'use no memo'
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 200)
  const parentRef = useRef<HTMLDivElement>(null)

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

  // Process participants based on view mode
  const processedParticipants = useMemo((): ProcessedParticipant[] => {
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
  }, [participants, viewMode])

  // Filter by search
  const filtered = useMemo(() => {
    if (!debouncedSearch) return processedParticipants
    const q = debouncedSearch.toLowerCase()
    return processedParticipants.filter((item) => {
      if (item.participant.gamerTag.toLowerCase().includes(q)) return true
      if (item.participant.prefix && item.participant.prefix.toLowerCase().includes(q)) return true
      return false
    })
  }, [processedParticipants, debouncedSearch])

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

  // Element scroll restoration for back/forward navigation
  const scrollEntry = useElementScrollRestoration({ id: 'participant-list' })
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (hasRestoredRef.current || !scrollEntry?.scrollY || filtered.length === 0) return
    hasRestoredRef.current = true
    requestAnimationFrame(() => {
      parentRef.current?.scrollTo({ top: scrollEntry.scrollY })
    })
  }, [scrollEntry, filtered.length])

  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo({ top: 0 })
  }, [])

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} width="100%" height={44} borderRadius={6} />
        ))}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.searchInput}
        placeholder="Search players..."
        value={searchInput}
        onChange={(e) => {
          setSearchInput(e.target.value)
          scrollToTop()
        }}
      />

      {filtered.length === 0 ? (
        <div className={styles.noResults}>No players found</div>
      ) : (
        <DataTable>
          <DataTableHeader className={showSeed ? styles.columns : styles.columnsNoSeed}>
            {showSeed && <span>Seed</span>}
            <span>Player</span>
            <span>Events</span>
          </DataTableHeader>
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
                  <ParticipantRow
                    participant={filtered[virtualRow.index].participant}
                    displaySeed={filtered[virtualRow.index].displaySeed}
                    showSeed={showSeed}
                    eventPhaseMap={eventPhaseMap}
                    eventNameMap={eventNameMap}
                  />
                </div>
              ))}
            </div>
          </div>
        </DataTable>
      )}
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
