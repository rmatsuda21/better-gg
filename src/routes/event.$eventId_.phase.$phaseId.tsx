import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePhaseBracket } from '../hooks/use-phase-bracket'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { extractBracketEntrants } from '../lib/bracket-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { BracketSearch } from '../components/BracketSearch/BracketSearch'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId_.phase.$phaseId.module.css'

export const Route = createFileRoute('/event/$eventId_/phase/$phaseId')({
  component: PhaseBracketPage,
})

function PhaseBracketPage() {
  const { eventId, phaseId } = Route.useParams()
  const { data: eventData, isLoading: eventLoading } = useEventDetails(eventId)
  const { data: bracketData, isLoading: bracketLoading, isError, error, refetch } = usePhaseBracket(phaseId)

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

      <BracketSearchSection
        bracketData={bracketData}
        showProjectionToggle={showProjectionToggle}
      />

      {bracketData.phaseGroups.length === 0 && (
        <ErrorMessage message="No bracket data available for this phase" />
      )}
    </div>
  )
}

function BracketSearchSection({
  bracketData,
  showProjectionToggle,
}: {
  bracketData: { phaseGroups: PhaseGroupInfo[] }
  showProjectionToggle: boolean
}) {
  const [searchedEntrantId, setSearchedEntrantId] = useState<string | null>(null)

  const bracketEntrants = useMemo(
    () => extractBracketEntrants(bracketData.phaseGroups),
    [bracketData.phaseGroups],
  )

  const effectiveEntrantId = searchedEntrantId ?? undefined

  // Scroll to the searched player's first set after selection
  const scrollTarget = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTarget.current) return
    const id = scrollTarget.current
    scrollTarget.current = null
    // Delay to allow pool expansion animation
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-entrant-ids*="${id}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => clearTimeout(timer)
  }, [searchedEntrantId])

  return (
    <>
      {bracketEntrants.length > 0 && (
        <div className={styles.searchRow}>
          <BracketSearch
            entrants={bracketEntrants}
            onSelect={(entrant) => {
              setSearchedEntrantId(entrant.entrantId)
              scrollTarget.current = entrant.entrantId
            }}
            onClear={() => setSearchedEntrantId(null)}
            hasSelection={searchedEntrantId != null}
          />
        </div>
      )}

      {bracketData.phaseGroups.length > 1 ? (
        <CollapsiblePools
          phaseGroups={bracketData.phaseGroups}
          userEntrantId={effectiveEntrantId}
          showProjectionToggle={showProjectionToggle}
        />
      ) : (
        bracketData.phaseGroups.map((pg) => (
          <div key={pg.phaseGroupId} className={styles.phaseGroupSection}>
            <BracketVisualization
              phaseGroup={pg}
              userEntrantId={effectiveEntrantId}
              showProjectionToggle={showProjectionToggle}
            />
          </div>
        ))
      )}
    </>
  )
}

function findUserPool(
  phaseGroups: PhaseGroupInfo[],
  userEntrantId: string | undefined,
): string | null {
  if (!userEntrantId) return null
  for (const pg of phaseGroups) {
    for (const set of pg.allSets) {
      for (const slot of set.slots ?? []) {
        const entrant = slot?.entrant ?? slot?.seed?.entrant
        if (entrant?.id && String(entrant.id) === String(userEntrantId)) {
          return pg.phaseGroupId
        }
      }
    }
  }
  return null
}

function CollapsiblePools({
  phaseGroups,
  userEntrantId,
  showProjectionToggle,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  showProjectionToggle: boolean
}) {
  const userPoolId = useMemo(
    () => findUserPool(phaseGroups, userEntrantId),
    [phaseGroups, userEntrantId],
  )

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (userPoolId) return new Set([userPoolId])
    // Default: expand first pool
    return phaseGroups.length > 0
      ? new Set([phaseGroups[0].phaseGroupId])
      : new Set()
  })

  // Auto-expand the pool when userEntrantId changes (e.g. from search)
  useEffect(() => {
    if (userPoolId && !expanded.has(userPoolId)) {
      setExpanded(prev => new Set([...prev, userPoolId]))
    }
  }, [userPoolId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {phaseGroups.map((pg) => {
        const isOpen = expanded.has(pg.phaseGroupId)
        return (
          <div key={pg.phaseGroupId} className={styles.phaseGroupSection}>
            <button
              className={`${styles.phaseGroupToggle} ${isOpen ? styles.phaseGroupToggleOpen : ''}`}
              onClick={() => toggle(pg.phaseGroupId)}
            >
              <span className={styles.phaseGroupArrow}>{isOpen ? '▼' : '▶'}</span>
              <h3 className={styles.phaseGroupLabel}>
                Pool {pg.displayIdentifier}
              </h3>
              {userPoolId === pg.phaseGroupId && (
                <span className={styles.userPoolBadge}>Your Pool</span>
              )}
            </button>
            {isOpen && (
              <BracketVisualization
                phaseGroup={pg}
                userEntrantId={userEntrantId}
                showProjectionToggle={showProjectionToggle}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
