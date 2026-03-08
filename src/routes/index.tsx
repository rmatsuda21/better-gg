import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import { useUserTournaments } from '../hooks/use-user-tournaments'
import { categorizeTournaments } from '../lib/tournament-utils'
import { TournamentSection } from '../components/TournamentSection/TournamentSection'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import type { PlayerRecord } from '../lib/player-search-types'
import styles from './index.module.css'

const PlayerSearch = lazy(() =>
  import('../components/PlayerSearch/PlayerSearch').then((m) => ({
    default: m.PlayerSearch,
  })),
)

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    user: (search.user as string) || undefined,
  }),
  component: HomePage,
})

function HomePage() {
  const { user } = Route.useSearch()
  const navigate = useNavigate()
  const [input, setInput] = useState(user ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      navigate({ to: '/', search: { user: trimmed } })
    }
  }

  function handlePlayerSelect(player: PlayerRecord) {
    if (player.disc) {
      navigate({ to: '/', search: { user: player.disc } })
    } else {
      navigate({ to: '/player/$playerId', params: { playerId: player.pid } })
    }
  }

  return (
    <>
      <div className={styles.searchSection}>
        <div>
          <p className={styles.sectionLabel}>Search by tag</p>
          <Suspense fallback={null}>
            <PlayerSearch onSelect={handlePlayerSelect} />
          </Suspense>
        </div>
        <div>
          <p className={styles.sectionLabel}>...or enter discriminator directly</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <input
              className={styles.input}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 97bc50e1"
            />
            <button className={styles.button} type="submit" disabled={!input.trim()}>
              Search
            </button>
          </form>
        </div>
      </div>
      {user && <TournamentResults discriminator={user} />}
    </>
  )
}

function TournamentResults({ discriminator }: { discriminator: string }) {
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

  const { current, upcoming, past } = categorizeTournaments(tournaments)

  let staggerIndex = 0

  return (
    <div className={styles.list}>
      {current.length > 0 && (
        <div className={styles.staggerWrapper} style={{ '--stagger': staggerIndex++ } as React.CSSProperties}>
          <TournamentSection
            title="Current"
            count={current.length}
            tournaments={current}
            status="current"
            userDiscriminator={discriminator}
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
            userDiscriminator={discriminator}
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
            userDiscriminator={discriminator}
          />
        </div>
      )}
    </div>
  )
}
