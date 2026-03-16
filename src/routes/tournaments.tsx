import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
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
  page?: number
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
    page: search.page ? Number(search.page) : undefined,
  }),
  component: TournamentsPage,
})

function isOnlineFilter(v: unknown): v is 'all' | 'online' | 'offline' {
  return v === 'all' || v === 'online' || v === 'offline'
}

function isStatusFilter(v: unknown): v is 'all' | 'upcoming' | 'past' {
  return v === 'all' || v === 'upcoming' || v === 'past'
}

function TournamentsPage() {
  const { q, country, state, online, status, featured, regOpen, sort, page } = Route.useSearch()
  const navigate = useNavigate({ from: '/tournaments' })

  const [searchInput, setSearchInput] = useState(q ?? '')

  const countrySelectOptions = useMemo(
    () => [
      { value: '', label: 'All regions' },
      ...rawCountryOptions.map((c) => ({ value: c.code, label: c.name })),
    ],
    [],
  )

  const currentPage = page ?? 1
  const onlineFilter: OnlineFilter = online ?? 'all'
  const statusFilter: StatusFilter = status ?? 'all'
  const sortBy = (sort ?? 'startAt desc') as SortOption

  const { tournaments, pageInfo, isLoading, isFetching } = useTournamentList({
    name: searchInput || undefined,
    countryCode: country,
    addrState: state,
    online: onlineFilter,
    status: statusFilter,
    featured,
    regOpen,
    sortBy,
    page: currentPage,
  })

  const total = pageInfo?.total ?? 0
  const totalPages = pageInfo?.totalPages ?? 0

  function updateSearch(updates: Partial<TournamentsSearch>) {
    // Reset page when any filter changes (unless page is explicitly set)
    const resetPage = !('page' in updates)
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
        ...(resetPage ? { page: undefined } : {}),
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
        {!isLoading && total > 0 && (
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
            <Skeleton key={i} width="100%" height={120} borderRadius={8} />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div className={styles.noResults}>No tournaments found</div>
      ) : (
        <>
          <div className={styles.resultsSummary}>
            {total.toLocaleString()} tournament{total !== 1 ? 's' : ''}
            {isFetching && ' ...'}
          </div>
          <div className={styles.cardGrid}>
            {tournaments.map((tournament, i) =>
              tournament ? (
                <div key={tournament.id ?? i} style={{ '--stagger': i } as React.CSSProperties}>
                  <TournamentCard tournament={tournament} />
                </div>
              ) : null,
            )}
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageButton}
                disabled={currentPage <= 1}
                onClick={() => updateSearch({ page: currentPage > 2 ? currentPage - 1 : undefined })}
              >
                Prev
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                disabled={currentPage >= totalPages}
                onClick={() => updateSearch({ page: currentPage + 1 })}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
