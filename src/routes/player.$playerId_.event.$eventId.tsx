import { createFileRoute } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePlayerEntrant } from '../hooks/use-player-entrant'
import { useEntrantSets } from '../hooks/use-entrant-sets'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
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

  const entrantId = entrantData?.entrantId
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

  return (
    <div className={styles.container}>
      <EventHeader event={event} eventId={eventId} />

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
