import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
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

interface ParticipantListProps {
  participants: TournamentParticipant[]
  events: EventInfo[]
  isLoading: boolean
}

export function ParticipantList({
  participants,
  events,
  isLoading,
}: ParticipantListProps) {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 200)
  const parentRef = useRef<HTMLDivElement>(null)

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

  // Filter participants by search
  const filtered = useMemo(() => {
    if (!debouncedSearch) return participants
    const q = debouncedSearch.toLowerCase()
    return participants.filter((p) => {
      if (p.gamerTag.toLowerCase().includes(q)) return true
      if (p.prefix && p.prefix.toLowerCase().includes(q)) return true
      return false
    })
  }, [participants, debouncedSearch])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  })

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
          <DataTableHeader className={styles.columns}>
            <span>Seed</span>
            <span>Player</span>
            <span>Events</span>
          </DataTableHeader>
          <div ref={parentRef} className={styles.scrollContainer}>
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
                    participant={filtered[virtualRow.index]}
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
  eventPhaseMap,
  eventNameMap,
}: {
  participant: TournamentParticipant
  eventPhaseMap: Map<string, string>
  eventNameMap: Map<string, string>
}) {
  return (
    <DataTableRow className={styles.rowColumns}>
      <div className={styles.seed}>
        {participant.bestSeed ?? '-'}
      </div>
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
