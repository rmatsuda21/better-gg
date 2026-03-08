import { useEffect, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useOpponentStats } from '../hooks/use-opponent-stats'
import { usePlayerProfile } from '../hooks/use-player-profile'
import { usePlayerRecentEvents } from '../hooks/use-player-recent-events'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap } from '../lib/character-utils'
import {
  computeWinRate,
  computeCharacterUsage,
} from '../lib/stats-utils'
import { formatWinRate } from '../lib/format'
import { PlayerProfileHeader } from '../components/PlayerProfileHeader/PlayerProfileHeader'
import { CharacterBar } from '../components/CharacterBar/CharacterBar'
import { PlacementList } from '../components/PlacementList/PlacementList'
import type { PlacementEntry } from '../components/PlacementList/PlacementList'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './player.$playerId.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

export const Route = createFileRoute('/player/$playerId')({
  component: PlayerPage,
})

function buildPlacementsFromEvents(
  pages: Array<{
    player?: {
      user?: {
        tournaments?: {
          nodes?: Array<{
            name?: string | null
            startAt?: unknown
            events?: Array<{
              id?: string | null
              name?: string | null
              numEntrants?: number | null
              userEntrant?: {
                standing?: { placement?: number | null } | null
              } | null
            } | null> | null
          } | null> | null
        } | null
      } | null
    } | null
  }>,
  playerId: string,
): PlacementEntry[] {
  const entries: PlacementEntry[] = []

  for (const page of pages) {
    const tournaments = page?.player?.user?.tournaments?.nodes ?? []
    for (const tournament of tournaments) {
      if (!tournament) continue
      for (const event of tournament.events ?? []) {
        if (!event) continue
        const placement = event.userEntrant?.standing?.placement
        if (placement == null) continue
        entries.push({
          placement,
          eventName: event.name ?? '',
          tournamentName: tournament.name ?? '',
          numEntrants: event.numEntrants,
          eventId: event.id ?? null,
          playerId,
        })
      }
    }
  }

  return entries
}

function PlayerPage() {
  const { playerId } = Route.useParams()
  const router = useRouter()

  // Phase 1: Profile (header data)
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
    error: profileErr,
    refetch: refetchProfile,
  } = usePlayerProfile(playerId, ULTIMATE_VIDEOGAME_ID)

  // Phase 2: Stats (win rate, characters) — parallel with profile
  const { data: statsData, isLoading: statsLoading } = useOpponentStats(
    playerId,
    true,
    ULTIMATE_VIDEOGAME_ID,
  )
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)

  // Phase 3: Recent events — depends on userId from profile
  const userId = profileData?.player?.user?.id ?? undefined
  const eventsQuery = usePlayerRecentEvents(
    playerId,
    userId,
    ULTIMATE_VIDEOGAME_ID,
  )

  // Auto-fetch next pages
  useEffect(() => {
    if (eventsQuery.hasNextPage && !eventsQuery.isFetchingNextPage) {
      eventsQuery.fetchNextPage()
    }
  }, [eventsQuery.hasNextPage, eventsQuery.isFetchingNextPage, eventsQuery.fetchNextPage])

  // Compute stats from opponent stats data
  const player = statsData?.player
  const characterMap = buildCharacterMap(charData?.videogame?.characters)
  const sets = player?.sets?.nodes ?? []
  const validSets = sets
    .filter((s): s is NonNullable<typeof s> => s != null)
    .filter((s) => String(s.event?.videogame?.id) === ULTIMATE_VIDEOGAME_ID)
  const winRate = player ? computeWinRate(validSets, player.id!) : null
  const charUsage = player
    ? computeCharacterUsage(validSets, player.id!).filter(
        (c) => characterMap.size === 0 || characterMap.has(c.characterId),
      )
    : []

  // Build placements from infinite query pages
  const placements = useMemo(() => {
    if (!eventsQuery.data?.pages) return []
    return buildPlacementsFromEvents(eventsQuery.data.pages, playerId)
  }, [eventsQuery.data?.pages, playerId])

  // Compute avg placement from events data
  const avgPlacement = useMemo(() => {
    if (placements.length === 0) return null
    const sum = placements.reduce((acc, p) => acc + p.placement, 0)
    return sum / placements.length
  }, [placements])

  // Phase 1 loading: show skeleton for header
  if (profileLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.skeletonCard}>
          <Skeleton width="100%" height={4} borderRadius={0} />
          <div className={styles.skeletonContent}>
            <div className={styles.skeletonRow}>
              <Skeleton width={96} height={96} borderRadius={48} />
              <div className={styles.skeletonInfo}>
                <Skeleton width="60%" height={28} borderRadius={6} />
                <Skeleton width="40%" height={16} borderRadius={4} />
                <Skeleton width="80%" height={16} borderRadius={4} />
              </div>
            </div>
            <Skeleton width="100%" height={60} borderRadius={8} />
          </div>
        </div>
        <Skeleton width="100%" height={120} borderRadius={8} />
      </div>
    )
  }

  if (profileError) {
    return (
      <ErrorMessage
        message={profileErr instanceof Error ? profileErr.message : 'Failed to load player'}
        onRetry={() => refetchProfile()}
      />
    )
  }

  const profile = profileData?.player
  if (!profile) {
    return <ErrorMessage message="Player not found" />
  }

  const eventsLoading = eventsQuery.isLoading
  const isLoadingMore = eventsQuery.isFetchingNextPage || eventsQuery.hasNextPage

  return (
    <div className={styles.container}>
      <button className={styles.backLink} onClick={() => router.history.back()}>
        &larr; Back
      </button>

      <PlayerProfileHeader
        profile={profile}
        winRate={winRate}
        avgPlacement={avgPlacement}
        formatWinRate={formatWinRate}
        isLoadingEvents={isLoadingMore}
        eventCount={placements.length}
      />

      {statsLoading ? (
        <div className={styles.sectionCard}>
          <Skeleton width="100%" height={80} borderRadius={8} />
        </div>
      ) : (
        charUsage.length > 0 && (
          <div className={`${styles.sectionCard} ${styles.sectionCardAnimated}`}>
            <h3 className={styles.sectionTitle}>Characters</h3>
            <CharacterBar usage={charUsage} characterMap={characterMap} />
          </div>
        )
      )}

      <div className={`${styles.sectionCard} ${!eventsLoading ? styles.sectionCardAnimated : ''}`}>
        <h3 className={styles.sectionTitle}>Recent Placements</h3>
        {eventsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} width="100%" height={24} borderRadius={4} />
            ))}
          </div>
        ) : (
          <PlacementList placements={placements} isLoadingMore={isLoadingMore} />
        )}
      </div>
    </div>
  )
}
