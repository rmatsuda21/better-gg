import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '../../hooks/use-auth'
import { usePlayerProfile } from '../../hooks/use-player-profile'
import { usePlayerUpcomingEvents } from '../../hooks/use-player-upcoming-events'
import { usePlayerRecentEvents } from '../../hooks/use-player-recent-events'
import { Skeleton } from '../Skeleton/Skeleton'
import { ULTIMATE_VIDEOGAME_ID, ALL_SMASH_VIDEOGAME_IDS } from '../../lib/smash-games'
import { formatPlacement } from '../../lib/format'
import styles from './WelcomeHero.module.css'

const RECENT_ACTIVITY_CUTOFF_S = 90 * 24 * 60 * 60
const NEXT_EVENT_CUTOFF_MS = 7 * 24 * 60 * 60 * 1000

function getGreeting(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'now'
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days >= 1) return `${days}d ${hours}h`
  const minutes = Math.floor(diffMs / (1000 * 60))
  return `${totalHours}h ${minutes % 60}m`
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface UpcomingNode {
  startAt?: unknown
  name?: string | null
}

interface RecentTournamentNode {
  startAt?: unknown
  name?: string | null
  events?: Array<{
    userEntrant?: { standing?: { placement?: number | null } | null } | null
  } | null> | null
}

interface StatHookCountdown { kind: 'countdown'; label: string }
interface StatHookForm { kind: 'form'; label: string }
interface StatHookLast { kind: 'last'; label: string }
interface StatHookNudge { kind: 'nudge'; label: string }
type StatHook = StatHookCountdown | StatHookForm | StatHookLast | StatHookNudge

function pickStatHook(
  upcoming: UpcomingNode | undefined,
  recent: RecentTournamentNode[],
  now: number,
): StatHook | null {
  if (upcoming?.startAt != null) {
    const startMs = Number(upcoming.startAt) * 1000
    const diff = startMs - now
    if (diff > 0 && diff <= NEXT_EVENT_CUTOFF_MS) {
      const name = upcoming.name ?? 'your next event'
      return { kind: 'countdown', label: `Next event in ${formatCountdown(diff)} — ${name}` }
    }
  }

  const recentPlacements: Array<{ placement: number; tournamentName: string; startAt: number }> = []
  for (const t of recent) {
    const startAt = Number(t?.startAt ?? 0)
    for (const ev of t?.events ?? []) {
      const placement = ev?.userEntrant?.standing?.placement
      if (placement != null) {
        recentPlacements.push({
          placement,
          tournamentName: t?.name ?? '',
          startAt,
        })
      }
    }
  }
  recentPlacements.sort((a, b) => b.startAt - a.startAt)
  const lastThree = recentPlacements.slice(0, 3)
  const top8Count = lastThree.filter((p) => p.placement <= 8).length

  if (top8Count > 0) {
    return {
      kind: 'form',
      label: top8Count === lastThree.length
        ? `Top 8 in your last ${lastThree.length} events`
        : `Top 8 in ${top8Count} of your last ${lastThree.length} events`,
    }
  }

  if (lastThree.length > 0) {
    const mostRecent = lastThree[0]
    const ageS = now / 1000 - mostRecent.startAt
    if (ageS <= RECENT_ACTIVITY_CUTOFF_S) {
      return {
        kind: 'last',
        label: `Last placement: ${formatPlacement(mostRecent.placement)} at ${mostRecent.tournamentName}`,
      }
    }
  }

  return { kind: 'nudge', label: 'Find a tournament near you' }
}

export function WelcomeHero() {
  const { user: authUser } = useAuth()
  const playerId = authUser?.playerId ?? undefined
  const displayName = authUser?.gamerTag ?? authUser?.name ?? 'Player'

  const [mountedAt] = useState(() => Date.now())
  const greeting = useMemo(() => getGreeting(new Date(mountedAt)), [mountedAt])

  const { data: profileData } = usePlayerProfile(playerId, ULTIMATE_VIDEOGAME_ID)
  const userId = authUser?.id ?? undefined
  const avatarUrl = profileData?.player?.user?.images?.[0]?.url ?? authUser?.profileImageUrl ?? null
  const topRanking = profileData?.player?.rankings?.[0]

  const { data: upcomingData } = usePlayerUpcomingEvents(playerId, userId)
  const recentEventsQuery = usePlayerRecentEvents(playerId, userId, ALL_SMASH_VIDEOGAME_IDS)

  const statHook = useMemo<StatHook | null>(() => {
    if (!profileData) return null
    const upcomingNodes = upcomingData?.player?.user?.tournaments?.nodes ?? []
    const upcoming = upcomingNodes
      .filter((n): n is NonNullable<typeof n> => n != null)
      .sort((a, b) => Number(a.startAt ?? 0) - Number(b.startAt ?? 0))[0]
    const firstPage = recentEventsQuery.data?.pages?.[0]
    const recent = (firstPage?.player?.user?.tournaments?.nodes ?? []).filter(
      (n): n is NonNullable<typeof n> => n != null,
    )
    return pickStatHook(upcoming, recent, mountedAt)
  }, [profileData, upcomingData, recentEventsQuery.data?.pages, mountedAt])

  const statHookLoading = !profileData || (recentEventsQuery.isLoading && !recentEventsQuery.data)

  return (
    <div className={styles.hero}>
      <div className={styles.avatarWrap}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className={styles.avatar} />
        ) : (
          <div className={styles.avatarFallback}>{getInitials(displayName)}</div>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.greeting}>
          <span className={styles.greetingPrefix}>{greeting},</span>{' '}
          <strong className={styles.greetingName}>{displayName}</strong>
        </div>
        <div className={styles.statHook}>
          {statHookLoading ? (
            <Skeleton width={260} height={14} borderRadius={4} />
          ) : statHook?.kind === 'nudge' ? (
            <Link to="/tournaments" className={styles.statHookLink}>
              {statHook.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          ) : statHook ? (
            <span className={styles.statHookText}>{statHook.label}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.right}>
        {topRanking?.rank != null && (
          <div className={styles.rankPill} title={topRanking.title ?? 'Ranking'}>
            <span className={styles.rankNumber}>#{topRanking.rank}</span>
            {topRanking.title && (
              <span className={styles.rankTitle}>{topRanking.title}</span>
            )}
          </div>
        )}
        {playerId && (
          <Link
            to="/player/$playerId"
            params={{ playerId }}
            className={styles.profilePill}
          >
            Your Profile
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
