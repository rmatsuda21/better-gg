import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTournamentList } from '../hooks/use-tournament-list'
import { getCountryOptions } from '../lib/country-utils'
import { TournamentCard } from '../components/TournamentCard/TournamentCard'
import { FilterToggle } from '../components/FilterToggle/FilterToggle'
import type { OnlineFilter } from '../components/FilterToggle/FilterToggle'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { FilterSelect } from '../components/FilterSelect/FilterSelect'
import styles from './tournaments.module.css'

type StatusFilter = 'all' | 'upcoming' | 'past'
type SortOption = 'startAt desc' | 'startAt asc' | 'endAt desc'

const SORT_SELECT_OPTIONS = [
  { value: 'startAt desc', label: 'Newest first' },
  { value: 'startAt asc', label: 'Oldest first' },
  { value: 'endAt desc', label: 'Recently updated' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

const STATE_SELECT_OPTIONS = [
  { value: '', label: 'All states' },
  ...US_STATES.map((s) => ({ value: s, label: s })),
]

const rawCountryOptions = getCountryOptions()

interface TournamentsSearch {
  q?: string
  country?: string
  state?: string
  online?: 'all' | 'online' | 'offline'
  status?: 'all' | 'upcoming' | 'past'
  featured?: boolean
  regOpen?: boolean
  sort?: string
}

export const Route = createFileRoute('/tournaments')({
  validateSearch: (search: Record<string, unknown>): TournamentsSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    country: typeof search.country === 'string' && search.country ? search.country : undefined,
    state: typeof search.state === 'string' && search.state ? search.state : undefined,
    online: isOnlineFilter(search.online) ? search.online : undefined,
    status: isStatusFilter(search.status) ? search.status : undefined,
    featured: search.featured === true || search.featured === 'true' ? true : undefined,
    regOpen: search.regOpen === true || search.regOpen === 'true' ? true : undefined,
    sort: typeof search.sort === 'string' && search.sort ? search.sort : undefined,
  }),
  component: TournamentsPage,
  pendingComponent: TournamentsPending,
})

function TournamentsPending() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      <Skeleton width={160} height={32} borderRadius={6} />
      <Skeleton width="100%" height={44} borderRadius={8} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width="100%" height={160} borderRadius={10} />
        ))}
      </div>
    </div>
  )
}

function isOnlineFilter(v: unknown): v is 'all' | 'online' | 'offline' {
  return v === 'all' || v === 'online' || v === 'offline'
}

function isStatusFilter(v: unknown): v is 'all' | 'upcoming' | 'past' {
  return v === 'all' || v === 'upcoming' || v === 'past'
}

function TournamentsPage() {
  const { q, country, state, online, status, featured, regOpen, sort } = Route.useSearch()
  const navigate = useNavigate({ from: '/tournaments' })

  const [searchInput, setSearchInput] = useState(q ?? '')

  const countrySelectOptions = useMemo(
    () => [
      { value: '', label: 'All regions' },
      ...rawCountryOptions.map((c) => ({ value: c.code, label: c.name })),
    ],
    [],
  )

  const onlineFilter: OnlineFilter = online ?? 'all'
  const statusFilter: StatusFilter = status ?? 'all'
  const sortBy = (sort ?? 'startAt desc') as SortOption

  const {
    tournaments,
    total,
    isClientFiltered,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useTournamentList({
    name: searchInput || undefined,
    countryCode: country,
    addrState: state,
    online: onlineFilter,
    status: statusFilter,
    featured,
    regOpen,
    sortBy,
  })

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  function updateSearch(updates: Partial<TournamentsSearch>) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    })
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    updateSearch({ q: value || undefined })
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Tournaments</h1>
        {!isLoading && total > 0 && !isClientFiltered && (
          <span className={styles.countBadge}>
            {total.toLocaleString()}
          </span>
        )}
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search tournaments..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <FilterSelect
          className={styles.filterSelect}
          value={country ?? ''}
          options={countrySelectOptions}
          onChange={(v) => {
            updateSearch({
              country: v || undefined,
              state: v === 'US' ? state : undefined,
            })
          }}
        />
        {country === 'US' && (
          <FilterSelect
            className={styles.filterSelect}
            value={state ?? ''}
            options={STATE_SELECT_OPTIONS}
            onChange={(v) => updateSearch({ state: v || undefined })}
          />
        )}
        <FilterSelect
          className={styles.filterSelect}
          value={sortBy}
          options={SORT_SELECT_OPTIONS}
          onChange={(v) => updateSearch({ sort: v !== 'startAt desc' ? v : undefined })}
        />
      </div>

      <div className={styles.filterRow}>
        <FilterToggle
          value={onlineFilter}
          onChange={(v) => updateSearch({ online: v !== 'all' ? v : undefined })}
        />
        <div className={styles.statusToggle}>
          {(['all', 'upcoming', 'past'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.statusOption} ${statusFilter === opt ? styles.statusActive : ''}`}
              onClick={() => updateSearch({ status: opt !== 'all' ? opt : undefined })}
            >
              {opt === 'all' ? 'All' : opt === 'upcoming' ? 'Upcoming' : 'Past'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.checkPill} ${featured ? styles.checkPillActive : ''}`}
          onClick={() => updateSearch({ featured: !featured || undefined })}
        >
          Featured
        </button>
        <button
          type="button"
          className={`${styles.checkPill} ${regOpen ? styles.checkPillActive : ''}`}
          onClick={() => updateSearch({ regOpen: !regOpen || undefined })}
        >
          Reg Open
        </button>
      </div>

      {isLoading ? (
        <div className={styles.skeletons}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} width="100%" height={200} borderRadius={10} />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className={styles.noResults}>No tournaments found</div>
      ) : (
        <>
          <div className={styles.resultsSummary}>
            {total.toLocaleString()}{isClientFiltered && hasNextPage ? '+' : ''} tournament{total !== 1 ? 's' : ''}
            {isFetching && !isFetchingNextPage && ' ...'}
          </div>
          <div className={styles.cardGrid}>
            {tournaments.map((tournament, i) =>
              tournament ? (
                <TournamentCard
                  key={tournament.id ?? i}
                  tournament={tournament}
                  variant="grid"
                  style={{ '--stagger': i < 24 ? i : 0 } as CSSProperties}
                />
              ) : null,
            )}
          </div>
          <div ref={sentinelRef} className={styles.loadingMore}>
            {isFetchingNextPage && (
              <span className={styles.loadingIndicator}>Loading more...</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
