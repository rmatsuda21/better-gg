import { useMemo, useState } from 'react'
import type { PhaseGroupInfo } from '../../hooks/use-entrant-sets'
import { useEntrantSets } from '../../hooks/use-entrant-sets'
import { buildBracketData, buildProjectedResults, buildEntrantPlayerMap } from '../../lib/bracket-utils'
import type { BracketEntrant } from '../../lib/bracket-utils'
import { computeHeadToHead } from '../../lib/stats-utils'
import { OpponentCard } from '../OpponentCard/OpponentCard'
import { BracketVisualization } from '../BracketVisualization/BracketVisualization'
import { Skeleton } from '../Skeleton/Skeleton'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import styles from './OpponentAnalysis.module.css'

/** Extract user-centric "W - L" score from name-included displayScore like "PlayerA 2 - PlayerB 3" */
function extractUserScore(
  displayScore: string | null | undefined,
  entrantId: string,
  slots: Array<{ entrant?: { id?: string | null } | null; seed?: { entrant?: { id?: string | null } | null } | null } | null> | null | undefined,
): string | null {
  if (!displayScore) return null
  const halves = displayScore.split(' - ')
  if (halves.length !== 2) return displayScore
  const s0 = halves[0].trim().split(/\s+/).pop() ?? ''
  const s1 = halves[1].trim().split(/\s+/).pop() ?? ''
  // Determine if slot[0] is the user's entrant
  const slot0Entrant = slots?.[0]?.entrant ?? slots?.[0]?.seed?.entrant
  const isSlot0User = slot0Entrant?.id === entrantId
  return isSlot0User ? `${s0} - ${s1}` : `${s1} - ${s0}`
}

interface OpponentAnalysisProps {
  entrantId: string
  playerId: string | null
  eventState?: string | null
  eventSlug?: string
}

interface OpponentInfo {
  setId: string | null
  entrantId: string | null
  name: string
  playerId: string | null
  setResult: string | null
  roundText: string | null
  won: boolean | undefined
  round: number
  seedNum: number | null
  isTBD: boolean
}

export function OpponentAnalysis({
  entrantId,
  eventState,
  eventSlug,
}: OpponentAnalysisProps) {
  const { data, isLoading, isError, error, refetch } = useEntrantSets(entrantId, eventState)

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} width="100%" height={50} borderRadius={8} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : 'Failed to load sets'}
        onRetry={() => refetch()}
      />
    )
  }

  const phaseGroups = data?.phaseGroups
  const userSeedNum = data?.entrant?.initialSeedNum

  // Grouped rendering for CREATED events with phase group data
  if (phaseGroups && phaseGroups.length > 0) {
    return (
      <div className={styles.container}>
        {userSeedNum != null && (
          <div className={styles.userSeed}>Seed #{userSeedNum}</div>
        )}
        {phaseGroups.map((pg) => (
          <PhaseGroupSection
            key={pg.phaseGroupId}
            phaseGroup={pg}
            entrantId={entrantId}
            eventState={eventState}
          />
        ))}
      </div>
    )
  }

  // Flat rendering for ACTIVE/COMPLETED events
  const sets = data?.entrant?.paginatedSets?.nodes ?? []

  const opponents: OpponentInfo[] = []
  for (const set of sets) {
    if (!set) continue
    const opponentSlot = set.slots?.find(
      (s) => s?.entrant?.id !== entrantId,
    )
    if (!opponentSlot?.entrant) continue

    const opPlayerId =
      opponentSlot.entrant.participants?.[0]?.player?.id ?? null

    const won =
      set.winnerId != null
        ? set.winnerId === Number(entrantId)
        : undefined

    opponents.push({
      setId: set.id ?? null,
      entrantId: opponentSlot.entrant.id!,
      name: opponentSlot.entrant.name ?? 'Unknown',
      playerId: opPlayerId,
      setResult: extractUserScore(set.displayScore, entrantId, set.slots),
      roundText: set.fullRoundText ?? null,
      won,
      round: set.round ?? 0,
      seedNum: opponentSlot.entrant.initialSeedNum ?? null,
      isTBD: false,
    })
  }

  if (opponents.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyMessage}>Bracket data not available yet.</p>
        <p className={styles.emptyHint}>
          Check back once the bracket is seeded or the event starts.
        </p>
        {eventSlug && (
          <a
            href={`https://start.gg/${eventSlug}/brackets`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.emptyLink}
          >
            View bracket on start.gg &rarr;
          </a>
        )}
      </div>
    )
  }

  const completedSets = sets.filter(
    (s): s is NonNullable<typeof s> => s != null && s.winnerId != null,
  )

  // Split by bracket side and sort by round progression
  const winners = opponents
    .filter((o) => o.round > 0)
    .sort((a, b) => a.round - b.round)
  const losers = opponents
    .filter((o) => o.round < 0)
    .sort((a, b) => Math.abs(a.round) - Math.abs(b.round))

  const allSorted = [...winners, ...losers]
  const currentOpponent = allSorted.find((o) => o.won === undefined)
  const hasBothSides = winners.length > 0 && losers.length > 0

  const renderOpponent = (op: OpponentInfo) => {
    const isCurrent = op === currentOpponent
    return (
      <div
        key={op.setId ?? `${op.entrantId}-${op.round}`}
        className={isCurrent ? styles.currentSet : undefined}
      >
        <OpponentCard
          name={op.name}
          playerId={op.playerId}
          setResult={op.setResult}
          roundText={op.roundText}
          won={op.won}
          seedNum={op.seedNum}
          headToHead={
            op.entrantId
              ? computeH2H(completedSets, entrantId, op.entrantId)
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {userSeedNum != null && (
        <div className={styles.userSeed}>Seed #{userSeedNum}</div>
      )}

      {hasBothSides ? (
        <>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Winners Bracket</h4>
            {winners.map(renderOpponent)}
          </div>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Losers Bracket</h4>
            {losers.map(renderOpponent)}
          </div>
        </>
      ) : (
        <div className={styles.section}>
          {allSorted.map(renderOpponent)}
        </div>
      )}
    </div>
  )
}

function parsePreviewSetId(id: string): { round: number; index: number } | null {
  // Format: preview_{pgId}_{round}_{index}
  const parts = id.split('_')
  if (parts.length < 4 || parts[0] !== 'preview') return null
  const round = parseInt(parts[parts.length - 2], 10)
  const index = parseInt(parts[parts.length - 1], 10)
  if (isNaN(round) || isNaN(index)) return null
  return { round, index }
}

function getFeederEntrants(
  setMap: Map<string, { slots?: Array<{ entrant?: { id?: string | null; name?: string | null } | null; seed?: { entrant?: { id?: string | null; name?: string | null } | null } | null } | null> | null }>,
  round: number,
  index: number,
): string | null {
  // In standard bracket topology, feeder set indices are 2*I and 2*I+1
  const feeder0 = setMap.get(`${round - 1}_${index * 2}`)
  const feeder1 = setMap.get(`${round - 1}_${index * 2 + 1}`)
  // One of these is typically the bye slot (may not exist or have no entrants)
  const feeder = feeder0 ?? feeder1
  if (!feeder?.slots) return null

  const resolveEnt = (slot: typeof feeder.slots[number]) =>
    slot?.entrant ?? slot?.seed?.entrant
  const names = feeder.slots
    .map((s) => resolveEnt(s)?.name)
    .filter((n): n is string => !!n)
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names[0]} vs ${names[1]}`
}

function buildProjectedOpponents(
  phaseGroup: PhaseGroupInfo,
  entrantId: string,
): OpponentInfo[] {
  const bracketData = buildBracketData(phaseGroup, entrantId)
  const projectedResults = buildProjectedResults(bracketData)
  const entrantPlayerMap = buildEntrantPlayerMap(phaseGroup)

  const opponents: OpponentInfo[] = []
  const allRounds = [...bracketData.winnersRounds, ...bracketData.losersRounds]

  for (const round of allRounds) {
    for (const set of round.sets) {
      const proj = projectedResults.get(set.id)
      if (!proj) continue

      const e0 = proj.entrants[0]
      const e1 = proj.entrants[1]
      const isUserSet = e0?.id === entrantId || e1?.id === entrantId
      if (!isUserSet) continue

      const opponent: BracketEntrant | null = e0?.id === entrantId ? e1 : e0
      if (!opponent) continue

      opponents.push({
        setId: set.id,
        entrantId: opponent.id,
        name: opponent.name,
        playerId: opponent.id ? entrantPlayerMap.get(opponent.id) ?? null : null,
        setResult: null,
        roundText: set.fullRoundText,
        won: undefined,
        round: set.round,
        seedNum: opponent.seedNum,
        isTBD: false,
      })
    }
  }

  // Sort by bracket progression: winners first, then losers, each by ascending round
  opponents.sort((a, b) => {
    if (a.round > 0 && b.round < 0) return -1
    if (a.round < 0 && b.round > 0) return 1
    return Math.abs(a.round) - Math.abs(b.round)
  })

  return opponents
}

function PhaseGroupSection({
  phaseGroup,
  entrantId,
  eventState,
}: {
  phaseGroup: PhaseGroupInfo
  entrantId: string
  eventState?: string | null
}) {
  const [viewMode, setViewMode] = useState<'list' | 'bracket'>('list')
  const [showProjected, setShowProjected] = useState(false)

  // Resolve entrant from either slot.entrant or slot.seed.entrant (fallback for CREATED events)
  type SlotType = NonNullable<NonNullable<(typeof phaseGroup.sets)[number]['slots']>[number]>
  const resolveEntrant = (slot: SlotType | null | undefined) =>
    slot?.entrant ?? slot?.seed?.entrant

  // Build set lookup by round_index for feeder resolution
  const setMap = new Map<string, (typeof phaseGroup.allSets)[number]>()
  for (const set of phaseGroup.allSets) {
    const parsed = parsePreviewSetId(String(set.id ?? ''))
    if (parsed) setMap.set(`${parsed.round}_${parsed.index}`, set)
  }

  // Build actual opponents list
  const actualOpponents: OpponentInfo[] = []

  for (const set of phaseGroup.sets) {
    // Skip sets where our entrant isn't in any slot
    if (!set.slots?.some((s) => resolveEntrant(s)?.id === entrantId)) continue

    const opponentSlot = set.slots?.find((s) => resolveEntrant(s)?.id !== entrantId)
    const opponentEntrant = opponentSlot ? resolveEntrant(opponentSlot) : null

    if (!opponentEntrant) {
      // Try to resolve feeder set for TBD opponents
      let name = 'TBD'
      const parsed = parsePreviewSetId(String(set.id ?? ''))
      if (parsed && parsed.round > 1) {
        const feederDesc = getFeederEntrants(setMap, parsed.round, parsed.index)
        if (feederDesc) {
          name = `Winner of ${feederDesc}`
        }
      }

      actualOpponents.push({
        setId: set.id ?? null,
        entrantId: null,
        name,
        playerId: null,
        setResult: null,
        roundText: set.fullRoundText ?? null,
        won: undefined,
        round: set.round ?? 0,
        seedNum: null,
        isTBD: true,
      })
      continue
    }

    actualOpponents.push({
      setId: set.id ?? null,
      entrantId: opponentEntrant.id!,
      name: opponentEntrant.name ?? 'Unknown',
      playerId: opponentEntrant.participants?.[0]?.player?.id ?? null,
      setResult: extractUserScore(set.displayScore, entrantId, set.slots),
      roundText: set.fullRoundText ?? null,
      won: set.winnerId != null ? set.winnerId === Number(entrantId) : undefined,
      round: set.round ?? 0,
      seedNum: opponentSlot?.seed?.seedNum ?? opponentEntrant.initialSeedNum ?? null,
      isTBD: false,
    })
  }

  // Sort by bracket progression: winners first, then losers, each by ascending round
  actualOpponents.sort((a, b) => {
    if (a.round > 0 && b.round < 0) return -1
    if (a.round < 0 && b.round > 0) return 1
    return Math.abs(a.round) - Math.abs(b.round)
  })

  const completedSets = phaseGroup.sets.filter(s => s.winnerId != null)

  const opponents = showProjected && viewMode === 'list'
    ? buildProjectedOpponents(phaseGroup, entrantId)
    : actualOpponents

  // Pre-compute bracket data for bracket view mode (must be before early return)
  const bracketData = useMemo(
    () => buildBracketData(phaseGroup, entrantId),
    [phaseGroup, entrantId],
  )
  const entrantPlayerMap = useMemo(
    () => buildEntrantPlayerMap(phaseGroup),
    [phaseGroup],
  )
  const projectedResults = useMemo(() => {
    if (!showProjected || viewMode !== 'bracket') return null
    return buildProjectedResults(bracketData)
  }, [showProjected, viewMode, bracketData])

  if (actualOpponents.length === 0) return null

  const title = [
    phaseGroup.phaseName,
    phaseGroup.displayIdentifier ? `Pool ${phaseGroup.displayIdentifier}` : null,
  ]
    .filter(Boolean)
    .join(' \u2014 ')

  return (
    <div className={styles.phaseGroup}>
      <div className={styles.phaseGroupHeader}>
        <span className={styles.phaseGroupTitle}>{title || 'Bracket'}</span>
        {phaseGroup.userSeedNum != null && (
          <span className={styles.seedBadge}>Seed #{phaseGroup.userSeedNum}</span>
        )}
        {viewMode === 'list' && eventState === 'CREATED' && (
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${!showProjected ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setShowProjected(false)}
            >
              Actual
            </button>
            <button
              className={`${styles.viewToggleBtn} ${showProjected ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setShowProjected(true)}
            >
              Projected
            </button>
          </div>
        )}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('list')}
          >
            List
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === 'bracket' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setViewMode('bracket')}
          >
            Bracket
          </button>
        </div>
      </div>

      {viewMode === 'bracket' ? (
        <BracketVisualization
          bracketData={bracketData}
          projectedResults={projectedResults}
          userEntrantId={entrantId}
          entrantPlayerMap={entrantPlayerMap}
        />
      ) : (
        opponents.map((op) => (
          <OpponentCard
            key={op.setId ?? `${op.entrantId}-${op.round}`}
            name={op.name}
            playerId={op.playerId}
            setResult={op.setResult}
            roundText={op.roundText}
            won={op.won}
            seedNum={op.seedNum}
            headToHead={
              op.entrantId
                ? computeH2H(completedSets, entrantId, op.entrantId)
                : undefined
            }
            isTBD={op.isTBD}
          />
        ))
      )}
    </div>
  )
}

interface MinimalSet {
  winnerId?: number | null
  slots?: Array<{ entrant?: { id?: string | null } | null } | null> | null
}

function computeH2H(
  sets: MinimalSet[],
  myEntrantId: string,
  opponentEntrantId: string,
) {
  return computeHeadToHead(sets, myEntrantId, opponentEntrantId)
}
