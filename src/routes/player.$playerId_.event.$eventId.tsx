import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePlayerEntrant } from '../hooks/use-player-entrant'
import { useEntrantSets } from '../hooks/use-entrant-sets'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useCharacters } from '../hooks/use-characters'
import { useSetDetails } from '../hooks/use-set-details'
import type { SetClickInfo } from '../lib/bracket-utils'
import { buildBracketData, buildEntrantPlayerMap } from '../lib/bracket-utils'
import { buildCharacterMap } from '../lib/character-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { SetDetails } from '../components/SetDetails/SetDetails'
import { SetDetailModal } from '../components/SetDetailModal/SetDetailModal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './player.$playerId_.event.$eventId.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

export const Route = createFileRoute('/player/$playerId_/event/$eventId')({
  validateSearch: (search: Record<string, unknown>): { expanded?: string } => ({
    expanded: typeof search.expanded === 'string' && search.expanded ? search.expanded : undefined,
  }),
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

  const [modalInfo, setModalInfo] = useState<SetClickInfo | null>(null)
  const { data: setDetailData } = useSetDetails(modalInfo?.setId ?? null)

  const handleSetClick = (info: SetClickInfo) => setModalInfo(info)

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
            <PlayerBracket
              phaseGroup={phaseGroups[0]}
              userEntrantId={entrantId}
              eventId={eventId}
              onSetClick={handleSetClick}
            />
          ) : (
            <CollapsiblePhaseGroups
              phaseGroups={phaseGroups}
              userEntrantId={entrantId}
              eventId={eventId}
              onSetClick={handleSetClick}
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
            onSetClick={handleSetClick}
          />
        )}
      </div>

      {modalInfo && entrantId && (
        <SetDetailModal
          isOpen
          onClose={() => setModalInfo(null)}
          preview={{
            fullRoundText: modalInfo.fullRoundText,
            winnerId: modalInfo.winnerId,
            scores: modalInfo.scores,
            isDQ: modalInfo.isDQ,
            entrants: modalInfo.entrants,
          }}
          userEntrantId={entrantId}
          games={setDetailData?.set?.games}
          gamesLoading={!setDetailData}
          characterMap={characterMap}
        />
      )}
    </div>
  )
}

function PlayerBracket({
  phaseGroup,
  userEntrantId,
  eventId,
  onSetClick,
}: {
  phaseGroup: PhaseGroupInfo
  userEntrantId?: string
  eventId: string
  onSetClick?: (info: SetClickInfo) => void
}) {
  const bracketData = useMemo(
    () => buildBracketData(phaseGroup, userEntrantId),
    [phaseGroup, userEntrantId],
  )
  const entrantPlayerMap = useMemo(
    () => buildEntrantPlayerMap(phaseGroup),
    [phaseGroup],
  )

  return (
    <BracketVisualization
      bracketData={bracketData}
      userEntrantId={userEntrantId}
      entrantPlayerMap={entrantPlayerMap}
      eventId={eventId}
      onSetClick={onSetClick}
    />
  )
}

function CollapsiblePhaseGroups({
  phaseGroups,
  userEntrantId,
  eventId,
  onSetClick,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  eventId: string
  onSetClick?: (info: SetClickInfo) => void
}) {
  const sorted = [...phaseGroups].sort(
    (a, b) => (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0),
  )

  const { expanded: expandedParam } = Route.useSearch()
  const navigate = useNavigate({ from: '/player/$playerId/event/$eventId' })

  const expanded = useMemo(
    () => new Set(expandedParam ? expandedParam.split(',') : []),
    [expandedParam],
  )

  const toggle = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const value = [...next].join(',')
    navigate({
      search: (prev) => ({ ...prev, expanded: value || undefined }),
      replace: true,
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
              <PlayerBracket
                phaseGroup={pg}
                userEntrantId={userEntrantId}
                eventId={eventId}
                onSetClick={onSetClick}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
