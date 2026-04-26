import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { TournamentHeader } from '../components/TournamentHeader/TournamentHeader'
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
      {event.tournament && (
        <TournamentHeader
          tournament={event.tournament}
          event={{
            name: event.name,
            videogameName: event.videogame?.name,
            numEntrants: event.numEntrants,
            isOnline: event.isOnline,
          }}
        />
      )}

      {(!event.phases || event.phases.length === 0) ? (
        <div className={styles.notPublished}>
          <p className={styles.notPublishedMessage}>
            Brackets have not been created yet.
          </p>
          <p className={styles.notPublishedHint}>
            Check back closer to the event start time, or view the event on start.gg for updates.
          </p>
          {event.slug && (
            <a
              href={`https://start.gg/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.notPublishedLink}
            >
              View on start.gg &rarr;
            </a>
          )}
        </div>
      ) : event.phases.every(p => p?.state === 'CREATED') ? (
        <div className={styles.notPublished}>
          <p className={styles.notPublishedMessage}>
            This event hasn&apos;t started yet.
          </p>
          <p className={styles.notPublishedHint}>
            View projected brackets below based on current seeding.
          </p>
        </div>
      ) : null}

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
