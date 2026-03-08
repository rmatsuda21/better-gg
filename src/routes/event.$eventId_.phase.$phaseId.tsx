import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { useUserEntrant } from '../hooks/use-user-entrant'
import { usePhaseBracket } from '../hooks/use-phase-bracket'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId_.phase.$phaseId.module.css'

export const Route = createFileRoute('/event/$eventId_/phase/$phaseId')({
  validateSearch: (search: Record<string, unknown>) => ({
    user: (search.user as string) || undefined,
  }),
  component: PhaseBracketPage,
})

function PhaseBracketPage() {
  const { eventId, phaseId } = Route.useParams()
  const { user } = Route.useSearch()
  const { data: eventData, isLoading: eventLoading } = useEventDetails(eventId)
  const { data: bracketData, isLoading: bracketLoading, isError, error, refetch } = usePhaseBracket(phaseId)
  const { data: userEntrant } = useUserEntrant(eventId, user)

  if (eventLoading || bracketLoading) {
    return (
      <div className={styles.container}>
        <Skeleton width="100%" height={160} borderRadius={8} />
        <Skeleton width="100%" height={400} borderRadius={8} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : 'Failed to load bracket'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!bracketData) {
    return <ErrorMessage message="Phase not found" />
  }

  const event = eventData?.event
  const showProjectionToggle = bracketData.eventState === 'CREATED'

  return (
    <div className={styles.container}>
      <Link
        to="/event/$eventId"
        params={{ eventId }}
        search={{ user }}
        className={styles.backLink}
      >
        &larr; Back to event
      </Link>

      {event && <EventHeader event={event} />}

      <div className={styles.phaseHeader}>
        <h2 className={styles.phaseTitle}>{bracketData.phaseName}</h2>
        <div className={styles.phaseMeta}>
          {bracketData.bracketType && (
            <span className={styles.bracketType}>{bracketData.bracketType}</span>
          )}
          {bracketData.phaseState && (
            <span
              className={`${styles.phaseState} ${
                bracketData.phaseState === 'COMPLETED'
                  ? styles.completed
                  : bracketData.phaseState === 'ACTIVE'
                    ? styles.active
                    : ''
              }`}
            >
              {bracketData.phaseState}
            </span>
          )}
        </div>
      </div>

      {bracketData.phaseGroups.map((pg) => (
        <div key={pg.phaseGroupId} className={styles.phaseGroupSection}>
          {bracketData.phaseGroups.length > 1 && (
            <h3 className={styles.phaseGroupLabel}>
              Pool {pg.displayIdentifier}
            </h3>
          )}
          <BracketVisualization
            phaseGroup={pg}
            userEntrantId={userEntrant?.entrantId}
            showProjectionToggle={showProjectionToggle}
          />
        </div>
      ))}

      {bracketData.phaseGroups.length === 0 && (
        <ErrorMessage message="No bracket data available for this phase" />
      )}
    </div>
  )
}
