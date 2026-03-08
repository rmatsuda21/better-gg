import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { useUserEntrant } from '../hooks/use-user-entrant'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { OpponentAnalysis } from '../components/OpponentAnalysis/OpponentAnalysis'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId.module.css'

export const Route = createFileRoute('/event/$eventId')({
  validateSearch: (search: Record<string, unknown>) => ({
    user: (search.user as string) || undefined,
  }),
  component: EventPage,
})

function EventPage() {
  const { eventId } = Route.useParams()
  const { user } = Route.useSearch()
  const { data, isLoading, isError, error, refetch } = useEventDetails(eventId)
  const { data: userEntrant, isLoading: entrantLoading } = useUserEntrant(eventId, user)

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
      <Link to="/" search={{ user }} className={styles.backLink}>
        &larr; Back to tournaments
      </Link>
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
                    search={{ user }}
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

      {user && (
        <div className={styles.analysis}>
          <h3 className={styles.sectionTitle}>Opponent Analysis</h3>
          {entrantLoading ? (
            <Skeleton width="100%" height={100} borderRadius={8} />
          ) : userEntrant ? (
            <OpponentAnalysis
              entrantId={userEntrant.entrantId}
              playerId={userEntrant.playerId}
              userDiscriminator={user}
              eventState={event.state}
              eventSlug={event.slug ?? undefined}
            />
          ) : (
            <p className={styles.notEntered}>
              User does not appear to be entered in this event.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
