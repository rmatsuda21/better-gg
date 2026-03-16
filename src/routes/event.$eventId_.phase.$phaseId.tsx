import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePhaseBracket } from '../hooks/use-phase-bracket'
import type { SetProgressionInfo } from '../hooks/use-phase-bracket'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import {
  extractBracketEntrants,
  computePhaseNav,
  buildBracketData,
  buildProjectedResults,
  getWinnerFromProjected,
  getLoserFromProjected,
} from '../lib/bracket-utils'
import type { PhaseNavInfo, BracketEntrant } from '../lib/bracket-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { BracketSearch } from '../components/BracketSearch/BracketSearch'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId_.phase.$phaseId.module.css'

interface PhaseBracketSearch {
  entrantId?: string
  projected?: boolean
}

export const Route = createFileRoute('/event/$eventId_/phase/$phaseId')({
  validateSearch: (search: Record<string, unknown>): PhaseBracketSearch => ({
    entrantId:
      typeof search.entrantId === 'string' && search.entrantId
        ? search.entrantId
        : typeof search.entrantId === 'number'
          ? String(search.entrantId)
          : undefined,
    projected:
      search.projected === true || search.projected === 'true'
        ? true
        : undefined,
  }),
  component: PhaseBracketPage,
})

function PhaseBracketPage() {
  const { eventId, phaseId } = Route.useParams()
  const { data: eventData, isLoading: eventLoading } = useEventDetails(eventId)
  const { data: bracketData, isLoading: bracketLoading, isError, error, refetch } = usePhaseBracket(phaseId)

  // Detect empty phase (no entrants populated yet)
  const hasAnyEntrants = useMemo(() => {
    if (!bracketData) return true
    return bracketData.phaseGroups.some(pg =>
      pg.allSets.some(set =>
        set.slots?.some(slot => {
          const ent = slot?.entrant ?? slot?.seed?.entrant
          return ent?.id != null
        })
      )
    )
  }, [bracketData])

  // Fetch origin phase data for cross-phase projection (only when current phase is empty)
  const originPhaseId = (!hasAnyEntrants && bracketData?.originPhaseIds?.[0]) || ''
  const { data: originData, isLoading: originLoading } = usePhaseBracket(originPhaseId)

  // Build seed overrides from projected origin phase losers/winners
  const seedOverrides = useMemo(() => {
    if (!originData || hasAnyEntrants) return undefined
    const overrides = new Map<number, BracketEntrant>()

    for (const pg of originData.phaseGroups) {
      const bracket = buildBracketData(pg)
      const projected = buildProjectedResults(bracket)

      for (const [setId, progInfo] of originData.progressionMap) {
        if (progInfo.loserPhase?.id === phaseId && progInfo.loserSeedNum != null) {
          const projSet = projected.get(setId)
          if (projSet) {
            const loser = getLoserFromProjected(projSet)
            if (loser) {
              overrides.set(progInfo.loserSeedNum, { ...loser, isProjected: true })
            }
          }
        }
        if (progInfo.winnerPhase?.id === phaseId && progInfo.winnerSeedNum != null) {
          const projSet = projected.get(setId)
          if (projSet) {
            const winner = getWinnerFromProjected(projSet)
            if (winner) {
              overrides.set(progInfo.winnerSeedNum, { ...winner, isProjected: true })
            }
          }
        }
      }
    }

    return overrides.size > 0 ? overrides : undefined
  }, [originData, hasAnyEntrants, phaseId])

  const isLoading = eventLoading || bracketLoading || (!!originPhaseId && originLoading)

  if (isLoading) {
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
  const showProjectionToggle = bracketData.phaseState !== 'COMPLETED'
  const phaseNav = computePhaseNav(bracketData.siblingPhases, bracketData.currentPhaseOrder, bracketData.originPhaseIds)
  // When cross-phase projection is active, force projected mode
  const forceProjected = !!seedOverrides

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
        key={phaseId}
        bracketData={bracketData}
        showProjectionToggle={showProjectionToggle}
        eventId={bracketData.eventId ?? eventId}
        phaseNav={phaseNav}
        progressionMap={bracketData.progressionMap}
        seedEntrantOverrides={seedOverrides}
        forceProjected={forceProjected}
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
  eventId,
  phaseNav,
  progressionMap,
  seedEntrantOverrides,
  forceProjected,
}: {
  bracketData: { phaseGroups: PhaseGroupInfo[] }
  showProjectionToggle: boolean
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap?: Map<string, SetProgressionInfo>
  seedEntrantOverrides?: Map<number, BracketEntrant>
  forceProjected?: boolean
}) {
  const { entrantId: urlEntrantId, projected: urlProjected } = Route.useSearch()
  const navigate = Route.useNavigate()
  const projected = forceProjected || (urlProjected ?? false)
  const setProjected = useCallback((value: boolean) => {
    navigate({ search: (prev) => ({ ...prev, projected: value || undefined }), replace: true })
  }, [navigate])
  const [searchedEntrantId, setSearchedEntrantId] = useState<string | null>(
    urlEntrantId ?? null,
  )

  const bracketEntrants = useMemo(
    () => extractBracketEntrants(bracketData.phaseGroups),
    [bracketData.phaseGroups],
  )

  const effectiveEntrantId = searchedEntrantId ?? undefined

  // Auto-scroll to URL entrant on initial load
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (
      !initialScrollDone.current &&
      urlEntrantId &&
      bracketEntrants.length > 0
    ) {
      initialScrollDone.current = true
      // Poll for the DOM element since bracket grid may not be rendered yet
      let attempts = 0
      const maxAttempts = 10
      const tryScroll = () => {
        const el = document.querySelector(
          `[data-entrant-ids*="${urlEntrantId}"]`,
        )
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else if (++attempts < maxAttempts) {
          timer = setTimeout(tryScroll, 150)
        }
      }
      let timer = setTimeout(tryScroll, 100)
      return () => {
        clearTimeout(timer)
        initialScrollDone.current = false
      }
    }
  }, [urlEntrantId, bracketEntrants.length])

  // Scroll to the searched player's first set after selection
  const scrollTarget = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTarget.current) return
    const id = scrollTarget.current
    // Delay to allow pool expansion animation
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-entrant-ids*="${id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        scrollTarget.current = null
      }
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
          projected={projected}
          onProjectedChange={setProjected}
          eventId={eventId}
          phaseNav={phaseNav}
          progressionMap={progressionMap}
          seedEntrantOverrides={seedEntrantOverrides}
        />
      ) : (
        bracketData.phaseGroups.map((pg) => (
          <div key={pg.phaseGroupId} className={styles.phaseGroupSection}>
            <BracketVisualization
              phaseGroup={pg}
              userEntrantId={effectiveEntrantId}
              showProjectionToggle={showProjectionToggle}
              projected={projected}
              onProjectedChange={setProjected}
              eventId={eventId}
              phaseNav={phaseNav}
              progressionMap={progressionMap}
              seedEntrantOverrides={seedEntrantOverrides}
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
  projected,
  onProjectedChange,
  eventId,
  phaseNav,
  progressionMap,
  seedEntrantOverrides,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  showProjectionToggle: boolean
  projected: boolean
  onProjectedChange: (v: boolean) => void
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap?: Map<string, SetProgressionInfo>
  seedEntrantOverrides?: Map<number, BracketEntrant>
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
                projected={projected}
                onProjectedChange={onProjectedChange}
                eventId={eventId}
                phaseNav={phaseNav}
                progressionMap={progressionMap}
                seedEntrantOverrides={seedEntrantOverrides}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
