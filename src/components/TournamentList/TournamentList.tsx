import { useUserTournaments } from '../../hooks/use-user-tournaments'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import { Skeleton } from '../Skeleton/Skeleton'
import { TournamentCard } from '../TournamentCard/TournamentCard'
import styles from './TournamentList.module.css'

interface TournamentListProps {
  userId: string
}

export function TournamentList({ userId }: TournamentListProps) {
  const { data, isLoading, isError, error, refetch } =
    useUserTournaments(userId)

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

  return (
    <div className={styles.list}>
      {tournaments.map(
        (tournament) =>
          tournament && (
            <TournamentCard key={tournament.id} tournament={tournament} />
          )
      )}
    </div>
  )
}
