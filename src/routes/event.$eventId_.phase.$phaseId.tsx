import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useEventDetails } from '../hooks/use-event-details'
import { useBracketMeta } from '../hooks/use-bracket-meta'
import { fetchPhaseGroupSetData, fetchPhaseGroupSetsWithByes } from '../hooks/use-bracket-sets'
import type { PhaseGroupSetResult } from '../hooks/use-bracket-sets'
import { useCrossPhaseOverrides } from '../hooks/use-cross-phase-overrides'
import { useOriginPhaseMap } from '../hooks/use-origin-phase-map'
import type { OriginPhaseGroupInfo } from '../hooks/use-origin-phase-map'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useSetDetails } from '../hooks/use-set-details'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import {
  computePhaseNav,
  buildBracketData,
  buildProjectedResults,
  buildEntrantPlayerMap,
  buildEntrantParticipantsMap,
  isPoolBracketType,
} from '../lib/bracket-utils'
import { formatRoundLabel } from '../lib/round-label-utils'
import { ACTIVITY_STATE, BRACKET_SCROLL_MAX_ATTEMPTS, STALE_TIME_MS, TIMING_MS } from '../lib/constants'
import type { BracketEntrant, PhaseNavInfo, SetClickInfo, SetProgressionInfo } from '../lib/bracket-utils'
import { TournamentHeader } from '../components/TournamentHeader/TournamentHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { BracketLoadingState } from '../components/BracketVisualization/BracketLoadingState'
import { PoolVisualization } from '../components/PoolVisualization/PoolVisualization'
import { PoolLoadingState } from '../components/PoolVisualization/PoolLoadingState'
import { SetDetailModal } from '../components/SetDetailModal/SetDetailModal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './event.$eventId_.phase.$phaseId.module.css'

interface PhaseBracketSearch {
  entrantId?: string
  projected?: boolean
}

function parseEntrantId(raw: unknown): string | undefined {
  if (typeof raw === 'number') return String(raw)
  if (typeof raw === 'string' && raw) return raw.replace(/^"|"$/g, '')
  return undefined
}

export const Route = createFileRoute('/event/$eventId_/phase/$phaseId')({
  validateSearch: (search: Record<string, unknown>): PhaseBracketSearch => ({
    entrantId: parseEntrantId(search.entrantId),
    projected:
      search.projected === true || search.projected === 'true'
        ? true
        : search.projected === false || search.projected === 'false'
          ? false
          : undefined,
  }),
  component: PhaseBracketPage,
  pendingComponent: PhaseBracketPending,
})

function PhaseBracketPending() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', animation: 'fadeIn 0.3s var(--ease-out-expo)' }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
      <Skeleton width="40%" height={28} borderRadius={6} />
      <BracketLoadingState />
    </div>
  )
}

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

  // Expanded/fetched state for lazy loading
  const [expandedPgIds, setExpandedPgIds] = useState<Set<string>>(new Set())
  const [fetchedPgIds, setFetchedPgIds] = useState<Set<string>>(new Set())
  const hasInitializedPgs = useRef(false)

  // Reset local state when URL params change (navigation to a different player/phase)
  const [prevParams, setPrevParams] = useState({ phaseId, urlEntrantId })
  if (prevParams.phaseId !== phaseId || prevParams.urlEntrantId !== urlEntrantId) {
    setPrevParams({ phaseId, urlEntrantId })
    setExpandedPgIds(new Set())
    setFetchedPgIds(new Set())
    hasInitializedPgs.current = false
  }

  // Initialize: expand and fetch the priority PG (user's pool or first PG)
  useEffect(() => {
    if (!meta?.phaseGroupNodes.length) return
    if (hasInitializedPgs.current) return
    hasInitializedPgs.current = true
    const priorityId = (urlEntrantId && meta.entrantPgMap.get(urlEntrantId))
      || meta.phaseGroupNodes[0].id
    setExpandedPgIds(new Set([priorityId]))
    setFetchedPgIds(new Set([priorityId]))
  }, [meta, urlEntrantId])

  const togglePg = useCallback((pgId: string) => {
    setExpandedPgIds(prev => {
      const next = new Set(prev)
      if (next.has(pgId)) next.delete(pgId)
      else next.add(pgId)
      return next
    })
    setFetchedPgIds(prev => prev.has(pgId) ? prev : new Set([...prev, pgId]))
  }, [])

  // Per-PG set queries — lazy: only fire for fetched PGs
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
      enabled: !!meta && fetchedPgIds.has(pg.id),
      staleTime: STALE_TIME_MS.DEFAULT,
    })),
  })

  // Build data map and loading set for CollapsiblePools
  const pgDataMap = useMemo(() => {
    const map = new Map<string, PhaseGroupSetResult>()
    for (const q of pgSetQueries) {
      if (q.data) map.set(q.data.pgId, q.data)
    }
    return map
  }, [pgSetQueries])

  const pgLoadingIds = useMemo(() => {
    const ids = new Set<string>()
    const nodes = meta?.phaseGroupNodes ?? []
    for (let i = 0; i < pgSetQueries.length; i++) {
      if (pgSetQueries[i].isLoading && nodes[i]) {
        ids.add(nodes[i].id)
      }
    }
    return ids
  }, [pgSetQueries, meta])

  // Identify user's pool from meta seed mapping (instant), fallback to loaded set data
  const userPoolId = useMemo(() => {
    if (!urlEntrantId || !meta) return null
    const fromMeta = meta.entrantPgMap.get(urlEntrantId)
    if (fromMeta) return fromMeta
    return findUserPool(
      pgSetQueries.filter(q => q.data).map(q => q.data!),
      urlEntrantId,
    )
  }, [urlEntrantId, meta, pgSetQueries])

  // Auto-expand user's pool when search changes
  useEffect(() => {
    if (!userPoolId) return
    setExpandedPgIds(prev => prev.has(userPoolId) ? prev : new Set([...prev, userPoolId]))
    setFetchedPgIds(prev => prev.has(userPoolId) ? prev : new Set([...prev, userPoolId]))
  }, [userPoolId])

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
    return pgSetQueries.every(q => !q.data)
  }, [pgSetQueries])

  const receivesProgressions = meta?.phaseState === ACTIVITY_STATE.CREATED && (meta?.originPhaseIds?.length ?? 0) > 0
  const isPoolFormat = isPoolBracketType(meta?.bracketType ?? null)
  const isMultiPool = (meta?.phaseGroupNodes.length ?? 0) > 1
  const showProjectionToggle = meta?.phaseState !== ACTIVITY_STATE.COMPLETED && !isPoolFormat

  // Projection toggle state (URL-driven)
  const hasOverrides = !hasAnyEntrants && receivesProgressions
  const projected = urlProjected ?? (hasOverrides ? true : false)
  const setProjected = useCallback((value: boolean) => {
    const searchValue = value ? true : (hasOverrides ? false : undefined)
    navigate({ search: (prev) => ({ ...prev, projected: searchValue }), replace: true })
  }, [navigate, hasOverrides])

  const isTeamEvent = meta?.isTeamEvent ?? false

  // Cross-phase overrides (lazy — only when Projected toggled + empty phase)
  const { data: crossPhaseData, isLoading: crossPhaseLoading } = useCrossPhaseOverrides(
    phaseId,
    meta?.originPhaseIds ?? [],
    meta?.phaseName ?? null,
    meta?.currentPhaseOrder ?? null,
    projected && !hasAnyEntrants && (meta?.originPhaseIds?.length ?? 0) > 0,
    isTeamEvent,
  )

  const seedOverrides = crossPhaseData?.seedOverrides?.size
    ? crossPhaseData.seedOverrides
    : undefined
  const seedIdToSeedNum = crossPhaseData?.seedIdToSeedNum

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

  // Origin phase entrant → phaseGroup mapping (for source nav nodes showing pool names)
  const originPhaseId = phaseNav.prevPhase?.id ?? null
  const originHasMultiplePGs = (phaseNav.prevPhase?.groupCount ?? 0) > 1
  const { data: originPhaseMap } = useOriginPhaseMap(originPhaseId, originHasMultiplePGs)

  const effectiveEventId = meta?.eventId ?? eventId

  // Auto-scroll to entrant's set (handles both URL-based and search-based)
  useEffect(() => {
    if (!urlEntrantId) return
    let attempts = 0
    const tryScroll = () => {
      const el = document.querySelector(`[data-entrant-ids*="${urlEntrantId}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      if (++attempts < BRACKET_SCROLL_MAX_ATTEMPTS) timer = setTimeout(tryScroll, TIMING_MS.BRACKET_SCROLL_RETRY)
    }
    let timer = setTimeout(tryScroll, TIMING_MS.BRACKET_SCROLL_RETRY_FAST)
    return () => clearTimeout(timer)
  }, [urlEntrantId, userPoolId])

  // Loading states
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
  const singlePgData = !isMultiPool && meta.phaseGroupNodes.length > 0
    ? pgDataMap.get(meta.phaseGroupNodes[0].id)
    : null
  const singlePgLoading = !isMultiPool && meta.phaseGroupNodes.length > 0
    && pgLoadingIds.has(meta.phaseGroupNodes[0].id)

  return (
    <div className={styles.container}>
      {event?.tournament && (
        <TournamentHeader
          tournament={event.tournament}
          event={{
            id: eventId,
            name: event.name,
            videogameName: event.videogame?.name,
            numEntrants: event.numEntrants,
            isOnline: event.isOnline,
          }}
        />
      )}

      <div className={styles.phaseHeader}>
        <h2 className={styles.phaseTitle}>{meta.phaseName}</h2>
        <div className={styles.phaseMeta}>
          {meta.bracketType && (
            <span className={styles.bracketType}>{meta.bracketType}</span>
          )}
          {meta.phaseState && (
            <span
              className={`${styles.phaseState} ${
                meta.phaseState === ACTIVITY_STATE.COMPLETED
                  ? styles.completed
                  : meta.phaseState === ACTIVITY_STATE.ACTIVE
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
      {showProjectionToggle && pgDataMap.size > 0 && (
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

      {anyPgError && (
        <ErrorMessage message="Failed to load some bracket data" />
      )}

      {/* Phase groups — single PG view */}
      {!isMultiPool && meta.phaseGroupNodes.length > 0 && (
        <div className={styles.phaseGroupSection}>
          {singlePgLoading && (isPoolFormat ? <PoolLoadingState /> : <BracketLoadingState />)}
          {singlePgData && (
            <PhaseGroupBracket
              pgData={singlePgData}
              bracketType={meta.bracketType}
              showProjected={projected}
              phaseState={meta.phaseState}
              receivesProgressions={receivesProgressions}
              seedOverrides={seedOverrides}
              seedIdToSeedNum={seedIdToSeedNum}
              userEntrantId={urlEntrantId}
              eventId={effectiveEventId}
              phaseNav={phaseNav}
              progressionMap={progressionMap}
              originPhaseMap={originPhaseMap}
              onSetClick={setModalInfo}
              isTeamEvent={isTeamEvent}
            />
          )}
        </div>
      )}

      {/* Phase groups — multi-pool collapsible view */}
      {isMultiPool && (
        <CollapsiblePools
          pgNodes={meta.phaseGroupNodes}
          pgDataMap={pgDataMap}
          pgLoadingIds={pgLoadingIds}
          expandedPgIds={expandedPgIds}
          onToggle={togglePg}
          bracketType={meta.bracketType}
          showProjected={projected}
          phaseState={meta.phaseState}
          receivesProgressions={receivesProgressions}
          seedOverrides={seedOverrides}
          seedIdToSeedNum={seedIdToSeedNum}
          userEntrantId={urlEntrantId}
          userPoolId={userPoolId}
          eventId={effectiveEventId}
          phaseNav={phaseNav}
          progressionMap={progressionMap}
          originPhaseMap={originPhaseMap}
          onSetClick={setModalInfo}
          isTeamEvent={isTeamEvent}
        />
      )}

      {meta.phaseGroupNodes.length === 0 && (
        meta.phaseState === ACTIVITY_STATE.CREATED ? (
          <div className={styles.notPublished}>
            <p className={styles.notPublishedMessage}>
              This phase has not been published yet.
            </p>
            <p className={styles.notPublishedHint}>
              Bracket data will appear once the organizer publishes seeding or the event begins.
            </p>
            {event?.slug && (
              <a
                href={`https://start.gg/${event.slug}/brackets`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.notPublishedLink}
              >
                View on start.gg &rarr;
              </a>
            )}
          </div>
        ) : (
          <ErrorMessage message="No bracket data available for this phase" />
        )
      )}

      {modalInfo && (
        <SetDetailModal
          isOpen
          onClose={() => setModalInfo(null)}
          preview={{ ...modalInfo }}
          userEntrantId={urlEntrantId}
          roundLabel={modalInfo.fullRoundText ? formatRoundLabel(modalInfo.fullRoundText) : undefined}
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
  bracketType: string | null
  showProjected: boolean
  phaseState: string | null
  receivesProgressions: boolean
  seedOverrides?: Map<number, BracketEntrant>
  seedIdToSeedNum?: Map<string, number>
  userEntrantId?: string
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap: Map<string, SetProgressionInfo>
  originPhaseMap?: Map<string, OriginPhaseGroupInfo>
  onSetClick: (info: SetClickInfo) => void
  isTeamEvent?: boolean
}

function PhaseGroupBracket({
  pgData,
  bracketType,
  showProjected,
  phaseState,
  receivesProgressions,
  seedOverrides,
  seedIdToSeedNum,
  userEntrantId,
  eventId,
  phaseNav,
  progressionMap,
  originPhaseMap,
  onSetClick,
  isTeamEvent,
}: PhaseGroupBracketProps) {
  const isPool = isPoolBracketType(bracketType)

  // Actual bracket data
  const bracketData = useMemo(() => {
    const suppress = !isPool && !showProjected && receivesProgressions
    return buildBracketData(pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, suppress, isTeamEvent)
  }, [pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, showProjected, receivesProgressions, isPool, isTeamEvent])

  // Entrant -> player ID map
  const entrantPlayerMap = useMemo(() => buildEntrantPlayerMap(pgData.pgInfo, isTeamEvent), [pgData.pgInfo, isTeamEvent])

  // Entrant -> participants map (for team events, provides player links in modals)
  const entrantParticipantsMap = useMemo(
    () => isTeamEvent ? buildEntrantParticipantsMap(pgData.pgInfo) : undefined,
    [pgData.pgInfo, isTeamEvent],
  )

  // Lazy: bye-inclusive sets for projection (needed for both CREATED and ACTIVE
  // phases because the regular query omits hidden bye rounds, causing losers
  // bracket prereqs to fail resolution)
  const needsByeSets = !isPool && showProjected && phaseState !== ACTIVITY_STATE.COMPLETED
  const { data: byeSets } = useQuery({
    queryKey: ['bracketByeSets', pgData.pgId, phaseState],
    queryFn: () => fetchPhaseGroupSetsWithByes(pgData.pgId, 35),
    enabled: needsByeSets,
    staleTime: STALE_TIME_MS.DEFAULT,
  })

  // Lazy: projection computation (skip for pool formats)
  const projectedResults = useMemo(() => {
    if (isPool || !showProjected) return null
    if (byeSets) {
      const projPgInfo: PhaseGroupInfo = { ...pgData.pgInfo, allSets: byeSets as PhaseGroupInfo['allSets'], sets: byeSets as PhaseGroupInfo['sets'] }
      const projBracket = buildBracketData(projPgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, undefined, isTeamEvent)
      return buildProjectedResults(projBracket)
    }
    return buildProjectedResults(bracketData)
  }, [isPool, showProjected, bracketData, byeSets, pgData.pgInfo, userEntrantId, seedOverrides, seedIdToSeedNum, isTeamEvent])

  if (isPool) {
    return (
      <PoolVisualization
        bracketData={bracketData}
        bracketType={bracketType!}
        userEntrantId={userEntrantId}
        entrantPlayerMap={entrantPlayerMap}
        entrantParticipantsMap={entrantParticipantsMap}
        eventId={eventId}
        phaseNav={phaseNav}
        onSetClick={onSetClick}
      />
    )
  }

  return (
    <BracketVisualization
      bracketData={bracketData}
      projectedResults={projectedResults}
      userEntrantId={userEntrantId}
      entrantPlayerMap={entrantPlayerMap}
      entrantParticipantsMap={entrantParticipantsMap}
      eventId={eventId}
      phaseNav={phaseNav}
      progressionMap={progressionMap}
      originPhaseMap={originPhaseMap}
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
  pgNodes,
  pgDataMap,
  pgLoadingIds,
  expandedPgIds,
  onToggle,
  bracketType,
  showProjected,
  phaseState,
  receivesProgressions,
  seedOverrides,
  seedIdToSeedNum,
  userEntrantId,
  userPoolId,
  eventId,
  phaseNav,
  progressionMap,
  originPhaseMap,
  onSetClick,
  isTeamEvent,
}: {
  pgNodes: Array<{ id: string; displayIdentifier: string | null }>
  pgDataMap: Map<string, PhaseGroupSetResult>
  pgLoadingIds: Set<string>
  expandedPgIds: Set<string>
  onToggle: (id: string) => void
  bracketType: string | null
  showProjected: boolean
  phaseState: string | null
  receivesProgressions: boolean
  seedOverrides?: Map<number, BracketEntrant>
  seedIdToSeedNum?: Map<string, number>
  userEntrantId?: string
  userPoolId: string | null
  eventId: string
  phaseNav: PhaseNavInfo
  progressionMap: Map<string, SetProgressionInfo>
  originPhaseMap?: Map<string, OriginPhaseGroupInfo>
  onSetClick: (info: SetClickInfo) => void
  isTeamEvent?: boolean
}) {
  return (
    <>
      {pgNodes.map((pg) => {
        const isOpen = expandedPgIds.has(pg.id)
        const data = pgDataMap.get(pg.id)
        const isLoading = pgLoadingIds.has(pg.id)
        return (
          <div key={pg.id} className={styles.phaseGroupSection}>
            <button
              className={`${styles.phaseGroupToggle} ${isOpen ? styles.phaseGroupToggleOpen : ''}`}
              onClick={() => onToggle(pg.id)}
            >
              <span className={styles.phaseGroupArrow}>{isOpen ? '▼' : '▶'}</span>
              <h3 className={styles.phaseGroupLabel}>
                Pool {pg.displayIdentifier}
              </h3>
              {userPoolId === pg.id && (
                <span className={styles.userPoolBadge}>Your Pool</span>
              )}
            </button>
            {isOpen && (
              isLoading ? (
                isPoolBracketType(bracketType) ? <PoolLoadingState /> : <BracketLoadingState />
              ) : data ? (
                <PhaseGroupBracket
                  pgData={data}
                  bracketType={bracketType}
                  showProjected={showProjected}
                  phaseState={phaseState}
                  receivesProgressions={receivesProgressions}
                  seedOverrides={seedOverrides}
                  seedIdToSeedNum={seedIdToSeedNum}
                  userEntrantId={userEntrantId}
                  eventId={eventId}
                  phaseNav={phaseNav}
                  progressionMap={progressionMap}
                  originPhaseMap={originPhaseMap}
                  onSetClick={onSetClick}
                  isTeamEvent={isTeamEvent}
                />
              ) : null
            )}
          </div>
        )
      })}
    </>
  )
}
