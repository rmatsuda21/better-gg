import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { useAuth } from '../hooks/use-auth'
import { useUserTournaments } from '../hooks/use-user-tournaments'
import { categorizeTournaments } from '../lib/tournament-utils'
import { TournamentSection } from '../components/TournamentSection/TournamentSection'
import { FilterToggle } from '../components/FilterToggle/FilterToggle'
import type { OnlineFilter } from '../components/FilterToggle/FilterToggle'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import type { PlayerRecord } from '../lib/player-search-types'
import type { TournamentSearchQuery } from '../gql/graphql'

type TournamentResult = NonNullable<NonNullable<NonNullable<TournamentSearchQuery['tournaments']>['nodes']>[number]>
import styles from './index.module.css'

const PlayerSearch = lazy(() =>
  import('../components/PlayerSearch/PlayerSearch').then((m) => ({
    default: m.PlayerSearch,
  })),
)

const TournamentSearch = lazy(() =>
  import('../components/TournamentSearch/TournamentSearch').then((m) => ({
    default: m.TournamentSearch,
  })),
)

export const Route = createFileRoute('/')({
  component: HomePage,
})

type SearchTab = 'players' | 'tournaments'

function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated, user: authUser } = useAuth()

  function handlePlayerSelect(player: PlayerRecord) {
    navigate({ to: '/player/$playerId', params: { playerId: player.pid } })
  }

  function handlePlayerSearch(query: string, country?: string) {
    const search: Record<string, string> = { q: query }
    if (country) search.country = country
    navigate({ to: '/players', search })
  }

  function handleTournamentSelect(tournament: TournamentResult) {
    if (!tournament.id) return
    navigate({ to: '/tournament/$tournamentId', params: { tournamentId: String(tournament.id) } })
  }

  return (
    <>
      {isAuthenticated ? (
        <>
          <WelcomeBar />
          <QuickSearchTrigger />
          {authUser?.discriminator && (
            <TournamentHub discriminator={authUser.discriminator} playerId={authUser.playerId ?? undefined} />
          )}
        </>
      ) : (
        <>
          <HeroSection
            onPlayerSelect={handlePlayerSelect}
            onPlayerSearch={handlePlayerSearch}
            onTournamentSelect={handleTournamentSelect}
          />
          <Features />
        </>
      )}
    </>
  )
}

/* ================================================================
   Logged-out: Hero section
   ================================================================ */

function HeroSection({
  onPlayerSelect,
  onPlayerSearch,
  onTournamentSelect,
}: {
  onPlayerSelect: (player: PlayerRecord) => void
  onPlayerSearch: (query: string, country?: string) => void
  onTournamentSelect: (tournament: TournamentResult) => void
}) {
  const { startOAuthFlow } = useAuth()
  const [searchTab, setSearchTab] = useState<SearchTab>('players')

  return (
    <div className={styles.hero}>
      <div className={styles.heroBackdrop}>
        <div className={styles.heroGlow} />
        <div className={styles.heroDotPattern} />
        <div className={styles.heroScanLine} />
      </div>

      <div className={styles.heroContent}>
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>
            The start.gg experience<br />
            <span className={styles.heroAccent}>you actually want</span>
          </h2>
          <p className={styles.heroSub}>
            Bracket visualization, opponent analysis, and tournament tracking — all in one place.
          </p>
          <div className={styles.heroCtas}>
            <button className={styles.heroCta} onClick={startOAuthFlow}>
              Login with start.gg
            </button>
            <a className={styles.heroSecondary} href="#search-card">
              or search without logging in
            </a>
          </div>
        </div>

        <div className={styles.heroSearch} id="search-card">
          <div className={styles.searchCard}>
            <div className={styles.searchTabs}>
              <button
                className={`${styles.searchTab} ${searchTab === 'players' ? styles.searchTabActive : ''}`}
                onClick={() => setSearchTab('players')}
                type="button"
              >
                Players
              </button>
              <button
                className={`${styles.searchTab} ${searchTab === 'tournaments' ? styles.searchTabActive : ''}`}
                onClick={() => setSearchTab('tournaments')}
                type="button"
              >
                Tournaments
              </button>
            </div>
            <div className={styles.searchBody}>
              <Suspense fallback={null}>
                {searchTab === 'players' ? (
                  <PlayerSearch onSelect={onPlayerSelect} onSearch={onPlayerSearch} />
                ) : (
                  <TournamentSearch onSelect={onTournamentSelect} />
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   Logged-out: Feature cards
   ================================================================ */

function Features() {
  return (
    <div className={styles.features}>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
          </svg>
        </div>
        <div>
          <h3 className={styles.featureTitle}>Track tournaments</h3>
          <p className={styles.featureDesc}>See current, upcoming, and past events at a glance.</p>
        </div>
      </div>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
        </div>
        <div>
          <h3 className={styles.featureTitle}>Analyze opponents</h3>
          <p className={styles.featureDesc}>Head-to-head records, character usage, and win rates.</p>
        </div>
      </div>
      <div className={styles.featureCard}>
        <div className={styles.featureIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </div>
        <div>
          <h3 className={styles.featureTitle}>Bracket paths</h3>
          <p className={styles.featureDesc}>Interactive bracket visualization with projected results.</p>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   Logged-in: Welcome bar
   ================================================================ */

function WelcomeBar() {
  const { user: authUser } = useAuth()
  const displayName = authUser?.gamerTag ?? authUser?.name ?? 'Player'

  return (
    <div className={styles.welcomeBar}>
      <span className={styles.welcomeText}>
        Welcome back, <strong>{displayName}</strong>
      </span>
      {authUser?.playerId && (
        <Link
          to="/player/$playerId"
          params={{ playerId: authUser.playerId }}
          className={styles.profilePill}
        >
          Your Profile
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      )}
    </div>
  )
}

/* ================================================================
   Logged-in: Quick search trigger (desktop only)
   ================================================================ */

function QuickSearchTrigger() {
  return (
    <button
      className={styles.quickSearch}
      onClick={() => {
        // Trigger Cmd+K
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <span className={styles.quickSearchText}>Search players or tournaments...</span>
      <span className={styles.quickSearchKbd}>⌘K</span>
    </button>
  )
}

/* ================================================================
   Logged-in: Tournament hub
   ================================================================ */

function TournamentHub({ discriminator, playerId }: { discriminator: string; playerId?: string }) {
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all')
  const [showPast, setShowPast] = useState(false)
  const { data, isLoading, isError, error, refetch } = useUserTournaments(discriminator)

  if (isLoading) {
    return (
      <div className={styles.hub}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width="100%" height={100} borderRadius={8} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        message={error instanceof Error ? error.message : 'Something went wrong'}
        onRetry={() => refetch()}
      />
    )
  }

  const tournaments = data?.user?.tournaments?.nodes
  if (!tournaments || tournaments.length === 0) {
    return (
      <div className={styles.hub}>
        <EmptyHubCta />
      </div>
    )
  }

  const filtered = onlineFilter === 'all'
    ? tournaments
    : tournaments.filter((t) => {
      if (!t) return false
      return onlineFilter === 'online' ? t.isOnline : !t.isOnline
    })

  const { current, upcoming, past } = categorizeTournaments(filtered)
  const hasTournaments = current.length > 0 || upcoming.length > 0
  const pastToShow = past.slice(0, 5)

  let staggerIndex = 0

  return (
    <div className={styles.hub}>
      <div className={styles.hubHeader}>
        <h3 className={styles.hubTitle}>Your Tournaments</h3>
        <FilterToggle value={onlineFilter} onChange={setOnlineFilter} />
      </div>

      {current.length > 0 && (
        <div className={styles.staggerWrapper} style={{ '--stagger': staggerIndex++ } as React.CSSProperties}>
          <TournamentSection
            title="Current"
            count={current.length}
            tournaments={current}
            status="current"
            playerId={playerId}
          />
        </div>
      )}
      {upcoming.length > 0 && (
        <div className={styles.staggerWrapper} style={{ '--stagger': staggerIndex++ } as React.CSSProperties}>
          <TournamentSection
            title="Upcoming"
            count={upcoming.length}
            tournaments={upcoming}
            status="upcoming"
            playerId={playerId}
          />
        </div>
      )}

      {!hasTournaments && past.length === 0 && onlineFilter !== 'all' && (
        <p className={styles.empty}>No {onlineFilter} tournaments found.</p>
      )}

      {!hasTournaments && past.length === 0 && onlineFilter === 'all' && (
        <EmptyHubCta />
      )}

      {past.length > 0 && (
        <div className={styles.pastSection}>
          {!showPast ? (
            <button
              className={styles.showPastButton}
              onClick={() => setShowPast(true)}
              type="button"
            >
              Show past ({past.length})
            </button>
          ) : (
            <div className={styles.pastContent}>
              <TournamentSection
                title="Past"
                count={past.length}
                tournaments={pastToShow}
                status="past"
                playerId={playerId}
              />
              {past.length > 5 && playerId && (
                <Link
                  to="/player/$playerId"
                  params={{ playerId }}
                  className={styles.viewAllLink}
                >
                  View all on profile
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyHubCta() {
  return (
    <Link to="/tournaments" className={styles.emptyCta}>
      <div className={styles.emptyCtaIcon}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </div>
      <div>
        <p className={styles.emptyCtaTitle}>Find your next tournament</p>
        <p className={styles.emptyCtaSub}>Browse and search upcoming events</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.emptyCtaArrow}>
        <path d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
    </Link>
  )
}
