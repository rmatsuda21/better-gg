import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePlayerEntrant } from '../hooks/use-player-entrant'
import { useEntrantSets } from '../hooks/use-entrant-sets'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useCharacters } from '../hooks/use-characters'
import { useSetDetails } from '../hooks/use-set-details'
import type { SetClickInfo } from '../lib/bracket-utils'
import { buildBracketData, buildProjectedResults, buildEntrantPlayerMap, buildEntrantParticipantsMap, isPoolBracketType } from '../lib/bracket-utils'
import { computeEventRoundLabels } from '../lib/round-label-utils'
import { buildCharacterMap } from '../lib/character-utils'
import { computeWinRate, computeCharacterUsage, computeUpsetFactor } from '../lib/stats-utils'
import { formatDateRange } from '../lib/format'
import { TournamentHeader } from '../components/TournamentHeader/TournamentHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { PoolVisualization } from '../components/PoolVisualization/PoolVisualization'
import { SetDetails } from '../components/SetDetails/SetDetails'
import { SetDetailModal } from '../components/SetDetailModal/SetDetailModal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import { ULTIMATE_VIDEOGAME_ID } from '../lib/smash-games'
import styles from './player.$playerId_.event.$eventId.module.css'

const LazyShareResultModal = lazy(() =>
  import('../components/ShareResultModal/ShareResultModal').then((m) => ({
    default: m.ShareResultModal,
  })),
)

export const Route = createFileRoute('/player/$playerId_/event/$eventId')({
  validateSearch: (search: Record<string, unknown>): { expanded?: string; projected?: boolean } => ({
    expanded: typeof search.expanded === 'string' && search.expanded ? search.expanded : undefined,
    projected:
      search.projected === true || search.projected === 'true'
        ? true
        : search.projected === false || search.projected === 'false'
          ? false
          : undefined,
  }),
  component: PlayerEventPage,
  pendingComponent: PlayerEventPending,
})

function PlayerEventPending() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <Skeleton width="100%" height={160} borderRadius={8} />
      <Skeleton width="100%" height={200} borderRadius={8} />
    </div>
  )
}

function PlayerEventPage() {
  const { playerId, eventId } = Route.useParams()
  const { projected: urlProjected } = Route.useSearch()
  const navigate = useNavigate({ from: '/player/$playerId/event/$eventId' })
  const { data: eventData, isLoading: eventLoading, isError, error, refetch } = useEventDetails(eventId)
  const { data: entrantData, isLoading: entrantLoading } = usePlayerEntrant(playerId, eventId)
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)

  const entrantId = entrantData?.entrantId != null ? String(entrantData.entrantId) : undefined
  const eventState = eventData?.event?.state
  const { data: setsData, isLoading: setsLoading } = useEntrantSets(entrantId, eventState)

  const characterMap = buildCharacterMap(charData?.videogame?.characters)

  const [modalInfo, setModalInfo] = useState<SetClickInfo | null>(null)
  const { data: setDetailData } = useSetDetails(modalInfo?.setId ?? null)
  const [showShareModal, setShowShareModal] = useState(false)

  const handleSetClick = (info: SetClickInfo) => setModalInfo(info)

  // Projection toggle (URL-driven, matching phase bracket route pattern)
  const projected = urlProjected ?? false
  const setProjected = useCallback((value: boolean) => {
    navigate({
      search: (prev) => ({ ...prev, projected: value || undefined }),
      replace: true,
    })
  }, [navigate])

  const event = eventData?.event ?? null
  const isTeamEvent = event?.type === 5

  const sets = useMemo(
    () => (setsData?.entrant?.paginatedSets?.nodes ?? []).filter(
      (s): s is NonNullable<typeof s> => s != null,
    ),
    [setsData],
  )

  const phaseGroups = setsData?.phaseGroups ?? []
  const showBracket = entrantData && phaseGroups.length > 0
  const hasNonPoolBracket = phaseGroups.some(pg => !isPoolBracketType(pg.bracketType))
  const showProjectionToggle = eventState !== 'COMPLETED' && hasNonPoolBracket && showBracket

  // Compute event-level round labels (Top N using event numEntrants + phase offsets)
  const roundLabels = useMemo(() => {
    if (!event) return new Map<string, string>()
    return computeEventRoundLabels(phaseGroups, event.numEntrants ?? 0)
  }, [phaseGroups, event])

  // Share graphic data
  const shareData = useMemo(() => {
    if (!event || !entrantData || sets.length === 0) return null

    const tournament = event.tournament
    const location = [tournament?.city, tournament?.addrState, tournament?.countryCode]
      .filter(Boolean)
      .join(', ')
    const dateRange =
      tournament?.startAt && tournament?.endAt
        ? formatDateRange(tournament.startAt, tournament.endAt)
        : ''

    const winRate = computeWinRate(sets, playerId)
    const charUsage = computeCharacterUsage(sets, playerId)
    const characters = charUsage.map((c) => ({
      characterId: c.characterId,
      characterName: characterMap.get(c.characterId) ?? `#${c.characterId}`,
      percentage: c.percentage,
    }))

    const resolveEntrant = (slot: { entrant?: { id?: string | null; name?: string | null; initialSeedNum?: number | null } | null; seed?: { entrant?: { id?: string | null; name?: string | null; initialSeedNum?: number | null } | null } | null } | null | undefined) =>
      slot?.entrant ?? slot?.seed?.entrant

    const setSummaries = sets.map((set) => {
      const oppSlot = set.slots?.find((s) => {
        const e = resolveEntrant(s)
        return e?.id != null && String(e.id) !== String(entrantId)
      })
      const oppEntrant = resolveEntrant(oppSlot)

      const isDQ = set.displayScore === 'DQ'
      const isWin = set.winnerId === Number(entrantId)

      // Parse score
      let score = ''
      if (isDQ) {
        score = 'DQ'
      } else if (set.displayScore) {
        const halves = set.displayScore.split(' - ')
        if (halves.length === 2) {
          const slot0Id = resolveEntrant(set.slots?.[0])?.id
          const isSlot0User = slot0Id != null && String(slot0Id) === String(entrantId)
          const userScore = halves[isSlot0User ? 0 : 1].trim().split(/\s+/).pop() ?? '-'
          const oppScore = halves[isSlot0User ? 1 : 0].trim().split(/\s+/).pop() ?? '-'
          score = `${userScore}-${oppScore}`
        }
      }

      const setId = String(set.id ?? '')

      const userSlot = set.slots?.find((s) => {
        const e = resolveEntrant(s)
        return e?.id != null && String(e.id) === String(entrantId)
      })
      const userSeedNum = resolveEntrant(userSlot)?.initialSeedNum ?? null
      const oppSeedNum = resolveEntrant(oppSlot)?.initialSeedNum ?? null
      let upsetFactor: number | null = null
      if (!isDQ && set.winnerId != null && userSeedNum != null && oppSeedNum != null) {
        const winnerSeed = isWin ? userSeedNum : oppSeedNum
        const loserSeed = isWin ? oppSeedNum : userSeedNum
        upsetFactor = computeUpsetFactor(winnerSeed, loserSeed)
      }

      return {
        opponentName: oppEntrant?.name ?? 'Unknown',
        isWin,
        isDQ,
        score,
        fullRoundText: roundLabels.get(setId) ?? set.fullRoundText ?? null,
        upsetFactor,
      }
    })

    return {
      tournamentName: tournament?.name ?? 'Tournament',
      eventName: event.name ?? 'Event',
      tournamentLogo: tournament?.images?.[0]?.url ?? null,
      dateRange,
      location,
      numEntrants: event.numEntrants ?? 0,
      isOnline: event.isOnline ?? false,
      playerTag: entrantData.entrantName ?? 'Player',
      placement: entrantData.placement,
      seed: setsData?.entrant?.initialSeedNum ?? null,
      wins: winRate.wins,
      losses: winRate.losses,
      sets: setSummaries,
      characters,
    }
  }, [event, entrantData, sets, playerId, entrantId, characterMap, setsData, roundLabels])

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

  if (!event) {
    return <ErrorMessage message="Event not found" />
  }

  return (
    <div className={styles.container}>
      {event.tournament && (
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

      {/* Share Result button */}
      {shareData && !setsLoading && (
        <button
          className={styles.shareButton}
          onClick={() => setShowShareModal(true)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 1v10m0-10L4.5 4.5M8 1l3.5 3.5M2 10.5V13a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0014 13v-2.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Share Result
        </button>
      )}

      {setsLoading && entrantData ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Bracket</h3>
          </div>
          <Skeleton width="100%" height={300} borderRadius={8} />
        </div>
      ) : showBracket && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Bracket</h3>
            {phaseGroups.length === 1 && (
              <div className={styles.sectionBadges}>
                {phaseGroups[0].bracketType && (
                  <span className={styles.bracketType}>{phaseGroups[0].bracketType}</span>
                )}
                {eventState && (
                  <span
                    className={`${styles.phaseState} ${
                      eventState === 'COMPLETED'
                        ? styles.completed
                        : eventState === 'ACTIVE'
                          ? styles.active
                          : ''
                    }`}
                  >
                    {eventState}
                  </span>
                )}
              </div>
            )}
          </div>
          {showProjectionToggle && (
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
            </div>
          )}
          {phaseGroups.length === 1 ? (
            <PlayerBracket
              phaseGroup={phaseGroups[0]}
              userEntrantId={entrantId}
              eventId={eventId}
              showProjected={projected}
              onSetClick={handleSetClick}
              isTeamEvent={isTeamEvent}
            />
          ) : (
            <CollapsiblePhaseGroups
              phaseGroups={phaseGroups}
              userEntrantId={entrantId}
              eventId={eventId}
              eventState={eventState}
              showProjected={projected}
              onSetClick={handleSetClick}
              isTeamEvent={isTeamEvent}
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
            roundLabels={roundLabels}
            onSetClick={handleSetClick}
            isTeamEvent={isTeamEvent}
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
          roundLabel={roundLabels.get(modalInfo.setId)}
          games={setDetailData?.set?.games}
          gamesLoading={!setDetailData}
          characterMap={characterMap}
        />
      )}

      {showShareModal && shareData && (
        <Suspense fallback={null}>
          <LazyShareResultModal
            isOpen
            onClose={() => setShowShareModal(false)}
            {...shareData}
          />
        </Suspense>
      )}
    </div>
  )
}

function PlayerBracket({
  phaseGroup,
  userEntrantId,
  eventId,
  showProjected,
  onSetClick,
  isTeamEvent,
}: {
  phaseGroup: PhaseGroupInfo
  userEntrantId?: string
  eventId: string
  showProjected: boolean
  onSetClick?: (info: SetClickInfo) => void
  isTeamEvent?: boolean
}) {
  const isPool = isPoolBracketType(phaseGroup.bracketType)
  const bracketData = useMemo(
    () => buildBracketData(phaseGroup, userEntrantId, undefined, undefined, undefined, isTeamEvent),
    [phaseGroup, userEntrantId, isTeamEvent],
  )
  const entrantPlayerMap = useMemo(
    () => buildEntrantPlayerMap(phaseGroup, isTeamEvent),
    [phaseGroup, isTeamEvent],
  )
  const entrantParticipantsMap = useMemo(
    () => isTeamEvent ? buildEntrantParticipantsMap(phaseGroup) : undefined,
    [phaseGroup, isTeamEvent],
  )
  const projectedResults = useMemo(() => {
    if (isPool || !showProjected) return null
    return buildProjectedResults(bracketData)
  }, [isPool, showProjected, bracketData])

  if (isPool) {
    return (
      <PoolVisualization
        bracketData={bracketData}
        bracketType={phaseGroup.bracketType!}
        userEntrantId={userEntrantId}
        entrantPlayerMap={entrantPlayerMap}
        entrantParticipantsMap={entrantParticipantsMap}
        eventId={eventId}
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
      onSetClick={onSetClick}
    />
  )
}

function CollapsiblePhaseGroups({
  phaseGroups,
  userEntrantId,
  eventId,
  eventState,
  showProjected,
  onSetClick,
  isTeamEvent,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  eventId: string
  eventState?: string | null
  showProjected: boolean
  onSetClick?: (info: SetClickInfo) => void
  isTeamEvent?: boolean
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
      resetScroll: false,
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
              {pg.bracketType && (
                <span className={styles.bracketType}>{pg.bracketType}</span>
              )}
              {eventState && (
                <span
                  className={`${styles.phaseState} ${
                    eventState === 'COMPLETED'
                      ? styles.completed
                      : eventState === 'ACTIVE'
                        ? styles.active
                        : ''
                  }`}
                >
                  {eventState}
                </span>
              )}
              {pg.userSeedNum != null && (
                <span className={styles.seedBadge}>Seed {pg.userSeedNum}</span>
              )}
            </button>
            {isOpen && (
              <PlayerBracket
                phaseGroup={pg}
                userEntrantId={userEntrantId}
                eventId={eventId}
                showProjected={showProjected}
                onSetClick={onSetClick}
                isTeamEvent={isTeamEvent}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
