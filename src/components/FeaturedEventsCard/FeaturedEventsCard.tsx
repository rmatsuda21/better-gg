import { useEffect, useMemo } from 'react'
import { useFeaturedEvents, FEATURED_MIN_ENTRANTS } from '../../hooks/use-featured-events'
import { TournamentCard } from '../TournamentCard/TournamentCard'
import type { TournamentCardData } from '../TournamentCard/TournamentCard'
import { Skeleton } from '../Skeleton/Skeleton'
import { ErrorMessage } from '../ErrorMessage/ErrorMessage'
import { getTournamentLiveness } from '../../lib/tournament-utils'
import styles from './FeaturedEventsCard.module.css'

const MAX_DISPLAYED = 12

export function FeaturedEventsCard() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useFeaturedEvents()

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const tournaments = useMemo(() => {
    const nodes = data?.pages.flatMap((p) => p?.tournaments?.nodes ?? []) ?? []
    return nodes
      .filter((t): t is NonNullable<typeof t> => t != null)
      .filter((t) => {
        const maxSmashEntrants = (t.events ?? []).reduce(
          (max, ev) => Math.max(max, ev?.numEntrants ?? 0),
          0,
        )
        return maxSmashEntrants >= FEATURED_MIN_ENTRANTS
      })
      .map((t): TournamentCardData & { _live: boolean } => ({
        id: t.id != null ? String(t.id) : null,
        name: t.name,
        slug: t.slug,
        startAt: t.startAt ?? null,
        endAt: t.endAt ?? null,
        numAttendees: t.numAttendees,
        city: t.city,
        addrState: t.addrState,
        countryCode: t.countryCode,
        isOnline: t.isOnline,
        venueName: t.venueName,
        images: t.images,
        bannerImages: t.bannerImages,
        events: t.events,
        _live: getTournamentLiveness(t.startAt, t.endAt)?.kind === 'live',
      }))
      .sort((a, b) => {
        if (a._live !== b._live) return Number(b._live) - Number(a._live)
        return Number(a.startAt ?? 0) - Number(b.startAt ?? 0)
      })
      .slice(0, MAX_DISPLAYED)
  }, [data?.pages])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Featured Events</h3>
        <span className={styles.subtitle}>Next 2 weeks · {FEATURED_MIN_ENTRANTS}+ entrants</span>
      </div>

      {isLoading ? (
        <div className={styles.scroller}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} width="100%" height={200} borderRadius={10} />
          ))}
        </div>
      ) : isError ? (
        <ErrorMessage
          message={error instanceof Error ? error.message : 'Failed to load featured events'}
          onRetry={() => refetch()}
        />
      ) : tournaments.length === 0 && !isFetchingNextPage ? (
        <p className={styles.empty}>No featured events right now. Check back soon.</p>
      ) : (
        <div className={styles.scroller}>
          {tournaments.map((t) => (
            <TournamentCard
              key={t.id}
              tournament={t}
              variant="grid"
              status={t._live ? 'current' : 'upcoming'}
              className={styles.cardItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}
