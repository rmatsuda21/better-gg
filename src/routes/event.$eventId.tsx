import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId.module.css'

export const Route = createFileRoute('/event/$eventId')({
  component: EventPage,
})

function EventPage() {
  const { eventId } = Route.useParams()
  const { data, isLoading, isError, error, refetch } = useEventDetails(eventId)

  if (isLoading) {
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

  const event = data?.event
  if (!event) {
    return <ErrorMessage message="Event not found" />
  }

  return (
    <div className={styles.container}>
      {event.tournament?.id ? (
        <Link
          to="/tournament/$tournamentId"
          params={{ tournamentId: String(event.tournament.id) }}
          className={styles.backLink}
        >
          &larr; Back to {event.tournament.name}
        </Link>
      ) : (
        <Link to="/" className={styles.backLink}>
          &larr; Back to tournaments
        </Link>
      )}
      <EventHeader event={event} />

      {event.phases && event.phases.length > 0 && (
        <div className={styles.phases}>
          <h3 className={styles.sectionTitle}>Phases</h3>
          <div className={styles.phaseList}>
            {event.phases.map(
              (phase) =>
                phase && (
                  <Link
                    key={phase.id}
                    to="/event/$eventId/phase/$phaseId"
                    params={{ eventId, phaseId: phase.id! }}
                    className={styles.phaseItem}
                  >
                    <span className={styles.phaseName}>{phase.name}</span>
                    <span className={styles.phaseMeta}>
                      {phase.bracketType && (
                        <span className={styles.bracketType}>{phase.bracketType}</span>
                      )}
                      {phase.state && (
                        <span
                          className={`${styles.phaseState} ${
                            phase.state === 'COMPLETED'
                              ? styles.completed
                              : phase.state === 'ACTIVE'
                                ? styles.active
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
        </div>
      )}
    </div>
  )
}
