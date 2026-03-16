import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/use-auth'
import { useUserTournaments } from '../hooks/use-user-tournaments'
import { categorizeTournaments } from '../lib/tournament-utils'
import { TournamentSection } from '../components/TournamentSection/TournamentSection'
import { FilterToggle } from '../components/FilterToggle/FilterToggle'
import type { OnlineFilter } from '../components/FilterToggle/FilterToggle'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import { graphql } from '../gql'
import { graphqlClient } from '../lib/graphql-client'
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

const resolveDiscriminatorQuery = graphql(`
  query ResolveDiscriminator($slug: String!) {
    user(slug: $slug) {
      player {
        id
      }
    }
  }
`)

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated, user: authUser } = useAuth()
  const [input, setInput] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    setIsResolving(true)
    setResolveError(null)
    try {
      const data = await graphqlClient.request(resolveDiscriminatorQuery, {
        slug: `user/${trimmed}`,
      })
      const playerId = data?.user?.player?.id
      if (!playerId) {
        setResolveError('No player profile found for this discriminator.')
        return
      }
      navigate({ to: '/player/$playerId', params: { playerId: String(playerId) } })
    } catch {
      setResolveError('User not found. Check the discriminator and try again.')
    } finally {
      setIsResolving(false)
    }
  }

  function handlePlayerSelect(player: PlayerRecord) {
    navigate({ to: '/player/$playerId', params: { playerId: player.pid } })
  }

  function handleTournamentSelect(tournament: TournamentResult) {
    if (!tournament.id) return
    navigate({ to: '/tournament/$tournamentId', params: { tournamentId: String(tournament.id) } })
  }

  return (
    <>
      <HeroSection
        onSelect={handlePlayerSelect}
        onTournamentSelect={handleTournamentSelect}
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isResolving={isResolving}
        resolveError={resolveError}
      />

      {isAuthenticated && authUser?.discriminator && (
        <TournamentResults discriminator={authUser.discriminator} playerId={authUser.playerId ?? undefined} />
      )}
    </>
  )
}

function SearchFields({
  input,
  setInput,
  onSubmit,
  onSelect,
  isResolving,
  resolveError,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onSelect: (player: PlayerRecord) => void
  isResolving?: boolean
  resolveError?: string | null
}) {
  return (
    <>
      <div>
        <label className={styles.sectionLabel}>Search by tag</label>
        <Suspense fallback={null}>
          <PlayerSearch onSelect={onSelect} />
        </Suspense>
      </div>
      <div className={styles.orDivider}>
        <div className={styles.orLine} />
        <span className={styles.orText}>or</span>
        <div className={styles.orLine} />
      </div>
      <div>
        <label className={styles.sectionLabel}>Enter discriminator</label>
        <form className={styles.form} onSubmit={onSubmit}>
          <input
            className={styles.input}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 97bc50e1"
          />
          <button className={styles.button} type="submit" disabled={!input.trim() || isResolving}>
            {isResolving ? 'Loading...' : 'Search'}
          </button>
        </form>
        {resolveError && (
          <p className={styles.resolveError}>{resolveError}</p>
        )}
      </div>
    </>
  )
}

function HeroSection({
  onSelect,
  onTournamentSelect,
  input,
  setInput,
  onSubmit,
  isResolving,
  resolveError,
}: {
  onSelect: (player: PlayerRecord) => void
  onTournamentSelect: (tournament: TournamentResult) => void
  input: string
  setInput: (v: string) => void
  onSubmit: (e: FormEvent) => void
  isResolving?: boolean
  resolveError?: string | null
}) {
  const { isAuthenticated, user: authUser, startOAuthFlow } = useAuth()
  const navigate = useNavigate()

  const displayName = authUser?.gamerTag ?? authUser?.name ?? 'Player'

  return (
    <div className={styles.hero}>
      <div className={styles.heroBackdrop}>
        <div className={styles.heroGlow} />
        <div className={styles.heroDotPattern} />
        <div className={styles.heroScanLine} />
      </div>

      <div className={styles.heroContent}>
        <div className={styles.heroText}>
          <span className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Tournament Tracker
          </span>
          {isAuthenticated ? (
            <>
              <h2 className={styles.heroTitle}>
                Welcome back,{' '}
                <span className={styles.heroAccent}>{displayName}</span>
              </h2>
              <p className={styles.heroSub}>
                Track your results, analyze opponents, and visualize your bracket path.
              </p>
              {authUser?.playerId && (
                <button
                  className={styles.heroCta}
                  onClick={() =>
                    navigate({
                      to: '/player/$playerId',
                      params: { playerId: authUser.playerId! },
                    })
                  }
                >
                  View your player page
                </button>
              )}
            </>
          ) : (
            <>
              <h2 className={styles.heroTitle}>
                Better Start.gg,<br />
                <span className={styles.heroAccent}>because you deserve it</span>
              </h2>
              <p className={styles.heroSub}>
                Visualize brackets, analyze opponents, and track your results across tournaments.
              </p>
              <button className={styles.heroCta} onClick={startOAuthFlow}>
                Login with start.gg
              </button>
            </>
          )}
        </div>

        <div className={styles.heroSearch}>
          <div className={`${styles.searchCard} ${styles.searchCardTop}`}>
            <p className={styles.searchCardHeader}>Find a player</p>
            <SearchFields
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              onSelect={onSelect}
              isResolving={isResolving}
              resolveError={resolveError}
            />
          </div>
          <div className={styles.searchCard}>
            <p className={styles.searchCardHeader}>Find a tournament</p>
            <Suspense fallback={null}>
              <TournamentSearch onSelect={onTournamentSelect} />
            </Suspense>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Track tournaments</h3>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Analyze opponents</h3>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Bracket paths</h3>
          </div>
        </div>
      )}
    </div>
  )
}

function TournamentResults({ discriminator, playerId }: { discriminator: string; playerId?: string }) {
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all')
  const { data, isLoading, isError, error, refetch } =
    useUserTournaments(discriminator)

  if (isLoading) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 5 }, (_, i) => (
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
    return <p className={styles.empty}>No tournaments found for this user.</p>
  }

  const filtered = onlineFilter === 'all'
    ? tournaments
    : tournaments.filter((t) => {
      if (!t) return false
      return onlineFilter === 'online' ? t.isOnline : !t.isOnline
    })

  const { current, upcoming, past } = categorizeTournaments(filtered)

  let staggerIndex = 0

  return (
    <div className={styles.list}>
      <div className={styles.filterRow}>
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
      {past.length > 0 && (
        <div className={styles.staggerWrapper} style={{ '--stagger': staggerIndex++ } as React.CSSProperties}>
          <TournamentSection
            title="Past"
            count={past.length}
            tournaments={past}
            status="past"
            playerId={playerId}
          />
        </div>
      )}
      {current.length === 0 && upcoming.length === 0 && past.length === 0 && onlineFilter !== 'all' && (
        <p className={styles.empty}>No {onlineFilter} tournaments found.</p>
      )}
    </div>
  )
}
