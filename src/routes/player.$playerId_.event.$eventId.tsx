import { lazy, Suspense, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEventDetails } from '../hooks/use-event-details'
import { usePlayerEntrant } from '../hooks/use-player-entrant'
import { useEntrantSets } from '../hooks/use-entrant-sets'
import type { PhaseGroupInfo } from '../hooks/use-entrant-sets'
import { useCharacters } from '../hooks/use-characters'
import { useSetDetails } from '../hooks/use-set-details'
import type { SetClickInfo } from '../lib/bracket-utils'
import { buildBracketData, buildEntrantPlayerMap } from '../lib/bracket-utils'
import { computeEventRoundLabels } from '../lib/round-label-utils'
import { buildCharacterMap } from '../lib/character-utils'
import { computeWinRate, computeCharacterUsage, computeUpsetFactor } from '../lib/stats-utils'
import { formatDateRange } from '../lib/format'
import { EventHeader } from '../components/EventHeader/EventHeader'
import { BracketVisualization } from '../components/BracketVisualization/BracketVisualization'
import { SetDetails } from '../components/SetDetails/SetDetails'
import { SetDetailModal } from '../components/SetDetailModal/SetDetailModal'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './player.$playerId_.event.$eventId.module.css'

const LazyShareResultModal = lazy(() =>
  import('../components/ShareResultModal/ShareResultModal').then((m) => ({
    default: m.ShareResultModal,
  })),
)

const ULTIMATE_VIDEOGAME_ID = '1386'

export const Route = createFileRoute('/player/$playerId_/event/$eventId')({
  validateSearch: (search: Record<string, unknown>): { expanded?: string } => ({
    expanded: typeof search.expanded === 'string' && search.expanded ? search.expanded : undefined,
  }),
  component: PlayerEventPage,
})

function PlayerEventPage() {
  const { playerId, eventId } = Route.useParams()
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

  const event = eventData?.event ?? null

  const sets = useMemo(
    () => (setsData?.entrant?.paginatedSets?.nodes ?? []).filter(
      (s): s is NonNullable<typeof s> => s != null,
    ),
    [setsData],
  )

  const phaseGroups = setsData?.phaseGroups ?? []
  const showBracket = entrantData && phaseGroups.length > 0

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
      <EventHeader event={event} eventId={eventId} />

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
          <h3 className={styles.sectionTitle}>Bracket</h3>
          <Skeleton width="100%" height={300} borderRadius={8} />
        </div>
      ) : showBracket && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Bracket</h3>
          {phaseGroups.length === 1 ? (
            <PlayerBracket
              phaseGroup={phaseGroups[0]}
              userEntrantId={entrantId}
              eventId={eventId}
              onSetClick={handleSetClick}
            />
          ) : (
            <CollapsiblePhaseGroups
              phaseGroups={phaseGroups}
              userEntrantId={entrantId}
              eventId={eventId}
              onSetClick={handleSetClick}
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
  onSetClick,
}: {
  phaseGroup: PhaseGroupInfo
  userEntrantId?: string
  eventId: string
  onSetClick?: (info: SetClickInfo) => void
}) {
  const bracketData = useMemo(
    () => buildBracketData(phaseGroup, userEntrantId),
    [phaseGroup, userEntrantId],
  )
  const entrantPlayerMap = useMemo(
    () => buildEntrantPlayerMap(phaseGroup),
    [phaseGroup],
  )

  return (
    <BracketVisualization
      bracketData={bracketData}
      userEntrantId={userEntrantId}
      entrantPlayerMap={entrantPlayerMap}
      eventId={eventId}
      onSetClick={onSetClick}
    />
  )
}

function CollapsiblePhaseGroups({
  phaseGroups,
  userEntrantId,
  eventId,
  onSetClick,
}: {
  phaseGroups: PhaseGroupInfo[]
  userEntrantId?: string
  eventId: string
  onSetClick?: (info: SetClickInfo) => void
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
              {pg.userSeedNum != null && (
                <span className={styles.seedBadge}>Seed {pg.userSeedNum}</span>
              )}
            </button>
            {isOpen && (
              <PlayerBracket
                phaseGroup={pg}
                userEntrantId={userEntrantId}
                eventId={eventId}
                onSetClick={onSetClick}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
