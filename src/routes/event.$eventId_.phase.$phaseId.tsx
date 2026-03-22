import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useEventDetails } from '../hooks/use-event-details'
import { useBracketMeta } from '../hooks/use-bracket-meta'
import { fetchPhaseGroupSetData, fetchPhaseGroupSetsWithByes } from '../hooks/use-bracket-sets'
import type { PhaseGroupSetResult } from '../hooks/use-bracket-sets'
import { useCrossPhaseOverrides } from '../hooks/use-cross-phase-overrides'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useSetDetails } from '../hooks/use-set-details'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import {
  extractBracketEntrants,
  computePhaseNav,
  buildBracketData,
  buildProjectedResults,
  buildEntrantPlayerMap,
} from '../lib/bracket-utils'
import type { BracketEntrant, PhaseNavInfo, SetClickInfo, SetProgressionInfo } from '../lib/bracket-utils'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { BracketSearch } from '../components/BracketSearch/BracketSearch'
import { SetDetailModal } from '../components/SetDetailModal/SetDetailModal'
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
        : search.projected === false || search.projected === 'false'
          ? false
          : undefined,
  }),
  component: PhaseBracketPage,
})

function PhaseBracketPage() {
  const { eventId, phaseId } = Route.useParams()
  const { entrantId: urlEntrantId, projected: urlProjected } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: eventData, isLoading: eventLoading } = useEventDetails(eventId)
  const { data: meta, isLoading: metaLoading, isError, error, refetch } = useBracketMeta(phaseId)

  const [modalInfo, setModalInfo] = useState<SetClickInfo | null>(null)
  const { data: setDetailData } = useSetDetails(modalInfo?.setId ?? null)

  const videogameId = eventData?.event?.videogame?.id ? String(eventData.event.videogame.id) : undefined
  const { data: charData } = useCharacters(videogameId)
  const characterMap = useMemo(() => buildCharacterMap(charData?.videogame?.characters), [charData])

  // Per-PG set queries — fire as soon as meta loads
  const pgSetQueries = useQueries({
    queries: (meta?.phaseGroupNodes ?? []).map(pg => ({
      queryKey: ['bracketSets', pg.id, meta?.phaseState],
      queryFn: () => fetchPhaseGroupSetData(
        pg.id,
        pg.displayIdentifier,
        meta!.phaseState,
        meta!.phaseName,
        meta!.currentPhaseOrder,
      ),
      enabled: !!meta,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // Detect empty phase (no entrants populated yet)
  const hasAnyEntrants = useMemo(() => {
    for (const q of pgSetQueries) {
      if (!q.data) continue
      const hasEnt = q.data.pgInfo.allSets.some(set =>
        set.slots?.some(slot => {
          const ent = slot?.entrant ?? slot?.seed?.entrant
          return ent?.id != null
        })
      )
      if (hasEnt) return true
    }
    // If no queries loaded yet, assume true (don't trigger overrides prematurely)
    return pgSetQueries.every(q => !q.data)
  }, [pgSetQueries])

  const receivesProgressions = meta?.phaseState === 'CREATED' && (meta?.originPhaseIds?.length ?? 0) > 0
  const showProjectionToggle = meta?.phaseState !== 'COMPLETED'

  // Projection toggle state (URL-driven)
  const hasOverrides = !hasAnyEntrants && receivesProgressions
  const projected = urlProjected ?? (hasOverrides ? true : false)
  const setProjected = useCallback((value: boolean) => {
    const searchValue = value ? true : (hasOverrides ? false : undefined)
    navigate({ search: (prev) => ({ ...prev, projected: searchValue }), replace: true })
  }, [navigate, hasOverrides])

  // Cross-phase overrides (lazy — only when Projected toggled + empty phase)
  const { data: crossPhaseData, isLoading: crossPhaseLoading } = useCrossPhaseOverrides(
    phaseId,
    meta?.originPhaseIds ?? [],
    meta?.phaseName ?? null,
    meta?.currentPhaseOrder ?? null,
    projected && !hasAnyEntrants && (meta?.originPhaseIds?.length ?? 0) > 0,
  )

  const seedOverrides = crossPhaseData?.seedOverrides?.size
    ? crossPhaseData.seedOverrides
    : undefined
  const seedIdToSeedNum = crossPhaseData?.seedIdToSeedNum

  // Aggregate entrants for search (from loaded PGs)
  const allEntrants = useMemo(
    () => extractBracketEntrants(
      pgSetQueries.filter(q => q.data).map(q => q.data!.pgInfo)
    ),
    [pgSetQueries],
  )

  // Aggregate progressionMap across PGs
  const progressionMap = useMemo(() => {
    const merged = new Map<string, SetProgressionInfo>()
    for (const q of pgSetQueries) {
      if (!q.data) continue
      for (const [k, v] of q.data.progressionMap) merged.set(k, v)
    }
    return merged
  }, [pgSetQueries])

  const phaseNav = useMemo(() => {
    if (!meta) return { prevPhase: null, nextPhase: null }
    return computePhaseNav(meta.siblingPhases, meta.currentPhaseOrder, meta.originPhaseIds)
  }, [meta])

  const effectiveEventId = meta?.eventId ?? eventId

  // Search state
  const [searchedEntrantId, setSearchedEntrantId] = useState<string | null>(
    urlEntrantId ?? null,
  )
  const effectiveEntrantId = searchedEntrantId ?? undefined

  // Auto-scroll to URL entrant on initial load
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (
      !initialScrollDone.current &&
      urlEntrantId &&
      allEntrants.length > 0
    ) {
      initialScrollDone.current = true
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
  }, [urlEntrantId, allEntrants.length])

  // Scroll to the searched player's first set after selection
  const scrollTarget = useRef<string | null>(null)
  useEffect(() => {
    if (!scrollTarget.current) return
    const id = scrollTarget.current
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-entrant-ids*="${id}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        scrollTarget.current = null
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [searchedEntrantId])

  // Loading states
  const allPgsLoading = pgSetQueries.length > 0 && pgSetQueries.every(q => q.isLoading)
  const anyPgError = pgSetQueries.some(q => q.isError)

  if (eventLoading || metaLoading) {
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

  if (!meta) {
    return <ErrorMessage message="Phase not found" />
  }

  const event = eventData?.event
  const loadedPgs = pgSetQueries.filter(q => q.data).map(q => q.data!)
  const hasPgs = loadedPgs.length > 0

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
        <h2 className={styles.phaseTitle}>{meta.phaseName}</h2>
        <div className={styles.phaseMeta}>
          {meta.bracketType && (
            <span className={styles.bracketType}>{meta.bracketType}</span>
          )}
          {meta.phaseState && (
            <span
              className={`${styles.phaseState} ${
                meta.phaseState === 'COMPLETED'
                  ? styles.completed
                  : meta.phaseState === 'ACTIVE'
                    ? styles.active
                    : ''
              }`}
            >
              {meta.phaseState}
            </span>
          )}
        </div>
      </div>

      {/* Projection toggle (route-level, shared across all PGs) */}
      {showProjectionToggle && hasPgs && (
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${!projected ? styles.toggleBtnActive : ''}`}
            onClick={() => setProjected(false)}
          >
            Actual
          </button>
          <button
            className={`${styles.toggleBtn} ${projected ? styles.toggleBtnActive : ''}`}
            onClick={() => setProjected(true)}
          >
            Projected
          </button>
          {projected && crossPhaseLoading && (
            <span className={styles.bracketType}>Loading projections...</span>
          )}
        </div>
      )}

      {/* Search */}
      {allEntrants.length > 0 && (
        <div className={styles.searchRow}>
          <BracketSearch
            entrants={allEntrants}
            onSelect={(entrant) => {
              setSearchedEntrantId(entrant.entrantId)
              scrollTarget.current = entrant.entrantId
            }}
            onClear={() => setSearchedEntrantId(null)}
            hasSelection={searchedEntrantId != null}
          />
        </div>
      )}

      {/* PG skeletons while loading */}
      {allPgsLoading && (
        <Skeleton width="100%" height={400} borderRadius={8} />
      )}

      {anyPgError && !allPgsLoading && (
        <ErrorMessage message="Failed to load some bracket data" />
      )}

      {/* Phase groups */}
      {hasPgs && (
        loadedPgs.length === 1 ? (
          <div className={styles.phaseGroupSection}>
            <PhaseGroupBracket
              pgData={loadedPgs[0]}
              showProjected={projected}
              phaseState={meta.phaseState}
              receivesProgressions={receivesProgressions}
              seedOverrides={seedOverrides}
              seedIdToSeedNum={seedIdToSeedNum}
              userEntrantId={effectiveEntrantId}
              eventId={effectiveEventId}
              phaseNav={phaseNav}
              progressionMap={progressionMap}
              onSetClick={setModalInfo}
            />
          </div>
        ) : (
          <CollapsiblePools
            pgDataList={loadedPgs}
            showProjected={projected}
            phaseState={meta.phaseState}
            receivesProgressions={receivesProgressions}
            seedOverrides={seedOverrides}
            seedIdToSeedNum={seedIdToSeedNum}
            userEntrantId={effectiveEntrantId}
            eventId={effectiveEventId}
            phaseNav={phaseNav}
            progressionMap={progressionMap}
            onSetClick={setModalInfo}
          />
        )
      )}

      {!allPgsLoading && !hasPgs && meta.phaseGroupNodes.length === 0 && (
        <ErrorMessage message="No bracket data available for this phase" />
      )}

      {modalInfo && (
        <SetDetailModal
          isOpen
          onClose={() => setModalInfo(null)}
          preview={{ ...modalInfo }}
          userEntrantId={urlEntrantId}
          games={setDetailData?.set?.games}
          gamesLoading={!setDetailData}
          characterMap={characterMap}
        />
      )}
    </div>
  )
}

interface PhaseGroupBracketProps {
  pgData: PhaseGroupSetResult
  showProjected: boolean
  phaseState: string | null
  receivesProgressions: boolean
  seedOverrides?: Map<number, BracketEntrant>
  seedIdToSeedNum?: Map<string, number>
  userEntrantId?: string
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap: Map<string, SetProgressionInfo>
  onSetClick: (info: SetClickInfo) => void
}

function PhaseGroupBracket({
  pgData,
  showProjected,
  phaseState,
  receivesProgressions,
  seedOverrides,
  seedIdToSeedNum,
  userEntrantId,
  eventId,
  phaseNav,
  progressionMap,
  onSetClick,
}: PhaseGroupBracketProps) {
  // Actual bracket data
  const bracketData = useMemo(() => {
    const suppress = !showProjected && receivesProgressions
    return buildBracketData(pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, suppress)
  }, [pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, showProjected, receivesProgressions])

  // Entrant -> player ID map
  const entrantPlayerMap = useMemo(() => buildEntrantPlayerMap(pgData.pgInfo), [pgData.pgInfo])

  // Lazy: bye-inclusive sets (only for CREATED projection)
  const { data: byeSets } = useQuery({
    queryKey: ['bracketByeSets', pgData.pgId],
    queryFn: () => fetchPhaseGroupSetsWithByes(pgData.pgId, 35),
    enabled: showProjected && phaseState === 'CREATED',
    staleTime: 5 * 60 * 1000,
  })

  // Lazy: projection computation
  const projectedResults = useMemo(() => {
    if (!showProjected) return null
    if (phaseState === 'CREATED' && byeSets) {
      const projPgInfo: PhaseGroupInfo = { ...pgData.pgInfo, allSets: byeSets as PhaseGroupInfo['allSets'], sets: byeSets as PhaseGroupInfo['sets'] }
      const projBracket = buildBracketData(projPgInfo, userEntrantId, seedOverrides, seedIdToSeedNum)
      return buildProjectedResults(projBracket)
    }
    return buildProjectedResults(bracketData)
  }, [showProjected, bracketData, byeSets, pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, phaseState])

  return (
    <BracketVisualization
      bracketData={bracketData}
      projectedResults={projectedResults}
      userEntrantId={userEntrantId}
      entrantPlayerMap={entrantPlayerMap}
      eventId={eventId}
      phaseNav={phaseNav}
      progressionMap={progressionMap}
      onSetClick={onSetClick}
    />
  )
}

function findUserPool(
  pgDataList: PhaseGroupSetResult[],
  userEntrantId: string | undefined,
): string | null {
  if (!userEntrantId) return null
  for (const pgData of pgDataList) {
    for (const set of pgData.pgInfo.allSets) {
      for (const slot of set.slots ?? []) {
        const entrant = slot?.entrant ?? slot?.seed?.entrant
        if (entrant?.id && String(entrant.id) === String(userEntrantId)) {
          return pgData.pgId
        }
      }
    }
  }
  return null
}

function CollapsiblePools({
  pgDataList,
  showProjected,
  phaseState,
  receivesProgressions,
  seedOverrides,
  seedIdToSeedNum,
  userEntrantId,
  eventId,
  phaseNav,
  progressionMap,
  onSetClick,
}: {
  pgDataList: PhaseGroupSetResult[]
  showProjected: boolean
  phaseState: string | null
  receivesProgressions: boolean
  seedOverrides?: Map<number, BracketEntrant>
  seedIdToSeedNum?: Map<string, number>
  userEntrantId?: string
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap: Map<string, SetProgressionInfo>
  onSetClick: (info: SetClickInfo) => void
}) {
  const userPoolId = useMemo(
    () => findUserPool(pgDataList, userEntrantId),
    [pgDataList, userEntrantId],
  )

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (userPoolId) return new Set([userPoolId])
    return pgDataList.length > 0
      ? new Set([pgDataList[0].pgId])
      : new Set()
  })

  // Auto-expand the pool when userEntrantId changes (e.g. from search)
  const [trackedUserPoolId, setTrackedUserPoolId] = useState(userPoolId)
  if (trackedUserPoolId !== userPoolId) {
    setTrackedUserPoolId(userPoolId)
    if (userPoolId && !expanded.has(userPoolId)) {
      setExpanded(prev => new Set([...prev, userPoolId]))
    }
  }

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
      {pgDataList.map((pgData) => {
        const isOpen = expanded.has(pgData.pgId)
        return (
          <div key={pgData.pgId} className={styles.phaseGroupSection}>
            <button
              className={`${styles.phaseGroupToggle} ${isOpen ? styles.phaseGroupToggleOpen : ''}`}
              onClick={() => toggle(pgData.pgId)}
            >
              <span className={styles.phaseGroupArrow}>{isOpen ? '▼' : '▶'}</span>
              <h3 className={styles.phaseGroupLabel}>
                Pool {pgData.displayIdentifier}
              </h3>
              {userPoolId === pgData.pgId && (
                <span className={styles.userPoolBadge}>Your Pool</span>
              )}
            </button>
            {isOpen && (
              <PhaseGroupBracket
                pgData={pgData}
                showProjected={showProjected}
                phaseState={phaseState}
                receivesProgressions={receivesProgressions}
                seedOverrides={seedOverrides}
                seedIdToSeedNum={seedIdToSeedNum}
                userEntrantId={userEntrantId}
                eventId={eventId}
                phaseNav={phaseNav}
                progressionMap={progressionMap}
                onSetClick={onSetClick}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
