import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePlayerEntrant } from '../hooks/use-player-entrant'
import { useEntrantSets } from '../hooks/use-entrant-sets'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { SetDetails } from '../components/SetDetails/SetDetails'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './player.$playerId_.event.$eventId.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

export const Route = createFileRoute('/player/$playerId_/event/$eventId')({
  component: PlayerEventPage,
})

function PlayerEventPage() {
  const { playerId, eventId } = Route.useParams()
  const { data: eventData, isLoading: eventLoading, isError, error, refetch } = useEventDetails(eventId)
  const { data: entrantData, isLoading: entrantLoading } = usePlayerEntrant(playerId, eventId)
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)

  const entrantId = entrantData?.entrantId != null ? String(entrantData.entrantId) : undefined
  const eventState = eventData?.event?.state
  const { data: setsData, isLoading: setsLoading } = useEntrantSets(entrantId, eventState)

  const characterMap = buildCharacterMap(charData?.videogame?.characters)

  if (eventLoading || entrantLoading) {
    return (
      <div className={styles.container}>
        <Skeleton width="100%" height={160} borderRadius={8} />
        <Skeleton width="100%" height={200} borderRadius={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : 'Failed to load event'}
        onRetry={() => refetch()}
      />
    )
  }

  const event = eventData?.event
  if (!event) {
    return <ErrorMessage message="Event not found" />
  }

  const sets = (setsData?.entrant?.paginatedSets?.nodes ?? []).filter(
    (s): s is NonNullable<typeof s> => s != null,
  )

  const phaseGroups = setsData?.phaseGroups ?? []
  const showBracket = entrantData && phaseGroups.length > 0

  return (
    <div className={styles.container}>
      <EventHeader event={event} eventId={eventId} />

      {setsLoading && entrantData ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Bracket</h3>
          <Skeleton width="100%" height={300} borderRadius={8} />
        </div>
      ) : showBracket && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Bracket</h3>
          {phaseGroups.length === 1 ? (
            <BracketVisualization
              phaseGroup={phaseGroups[0]}
              userEntrantId={entrantId}
              showProjectionToggle={eventState !== 'COMPLETED'}
              eventId={eventId}
            />
          ) : (
            <CollapsiblePhaseGroups
              phaseGroups={phaseGroups}
              userEntrantId={entrantId}
              eventState={eventState}
              eventId={eventId}
            />
          )}
        </div>
      )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Set Results</h3>
        {!entrantData ? (
          <p className={styles.notEntered}>Player was not entered in this event.</p>
        ) : setsLoading ? (
          <Skeleton width="100%" height={200} borderRadius={8} />
        ) : (
          <SetDetails
            sets={sets}
            userEntrantId={entrantId!}
            characterMap={characterMap}
          />
        )}
      </div>
    </div>
  )
}

function CollapsiblePhaseGroups({
  phaseGroups,
  userEntrantId,
  eventState,
  eventId,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  eventState?: string | null
  eventId: string
}) {
  const sorted = [...phaseGroups].sort(
    (a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0),
  )

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {sorted.map(pg => {
        const isOpen = expanded.has(pg.phaseGroupId)
        const label = pg.phaseName
          ? pg.displayIdentifier
            ? `${pg.phaseName} — Pool ${pg.displayIdentifier}`
            : pg.phaseName
          : `Pool ${pg.displayIdentifier ?? pg.phaseGroupId}`

        return (
          <div key={pg.phaseGroupId} className={styles.phaseGroupSection}>
            <button
              className={`${styles.phaseGroupToggle} ${isOpen ? styles.phaseGroupToggleOpen : ''}`}
              onClick={() => toggle(pg.phaseGroupId)}
            >
              <span className={styles.phaseGroupArrow}>{isOpen ? '▼' : '▶'}</span>
              <h3 className={styles.phaseGroupLabel}>{label}</h3>
              {pg.userSeedNum != null && (
                <span className={styles.seedBadge}>Seed {pg.userSeedNum}</span>
              )}
            </button>
            {isOpen && (
              <BracketVisualization
                phaseGroup={pg}
                userEntrantId={userEntrantId}
                showProjectionToggle={eventState !== 'COMPLETED'}
                eventId={eventId}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
