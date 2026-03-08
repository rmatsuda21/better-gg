import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useUserTournaments } from '../hooks/use-user-tournaments'
import { categorizeTournaments } from '../lib/tournament-utils'
import { TournamentSection } from '../components/TournamentSection/TournamentSection'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { ErrorMessage } from '../components/ErrorMessage/ErrorMessage'
import styles from './index.module.css'

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

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter user discriminator (e.g. 97bc50e1)"
        />
        <button className={styles.button} type="submit" disabled={!input.trim()}>
          Search
        </button>
      </form>
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

  return (
    <div className={styles.list}>
      {current.length > 0 && (
        <TournamentSection
          title="Current"
          count={current.length}
          tournaments={current}
          status="current"
          userDiscriminator={discriminator}
        />
      )}
      {upcoming.length > 0 && (
        <TournamentSection
          title="Upcoming"
          count={upcoming.length}
          tournaments={upcoming}
          status="upcoming"
          userDiscriminator={discriminator}
        />
      )}
      {past.length > 0 && (
        <TournamentSection
          title="Past"
          count={past.length}
          tournaments={past}
          status="past"
          userDiscriminator={discriminator}
        />
      )}
    </div>
  )
}
