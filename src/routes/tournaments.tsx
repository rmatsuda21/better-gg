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
import { THRESHOLDS } from '../lib/constants'
import styles from './tournaments.module.css'

type StatusFilter = 'all' | 'upcoming' | 'live' | 'past'
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

const GAME_SELECT_OPTIONS = [
  { value: '', label: 'All Smash' },
  { value: '1386', label: 'Ultimate' },
  { value: '1', label: 'Melee' },
  { value: '4', label: 'Smash 64' },
  { value: '5', label: 'Brawl' },
  { value: '3', label: 'Smash 4 (Wii U)' },
  { value: '29', label: 'Smash 4 (3DS)' },
]

const rawCountryOptions = getCountryOptions()

const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function IconSearch() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  )
}

function IconGlobe() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 010 18" />
      <path d="M12 3a14 14 0 000 18" />
    </svg>
  )
}

function IconMapPin() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconGamepad() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M6 12h4M8 10v4" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="17.5" cy="14" r="1" />
      <path d="M5 16a4 4 0 01-4-4 4 4 0 014-4h14a4 4 0 014 4 4 4 0 01-4 4l-2-2H7l-2 2z" />
    </svg>
  )
}

function IconSort() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M6 12h12" />
      <path d="M10 18h4" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function IconSliders() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M4 6h10M18 6h2" />
      <path d="M4 12h4M12 12h8" />
      <path d="M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  )
}

function IconX() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

interface TournamentsSearch {
  q?: string
  country?: string
  state?: string
  online?: 'all' | 'online' | 'offline'
  status?: 'all' | 'upcoming' | 'live' | 'past'
  featured?: boolean
  regOpen?: boolean
  staffPicks?: boolean
  hasBanner?: boolean
  minEntrants?: number
  after?: number
  before?: number
  game?: string
  sort?: string
}

function parseOptionalInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.floor(v)
  if (typeof v === 'string' && v) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return undefined
}

function unixToDateInputValue(s?: number): string {
  if (!s) return ''
  const d = new Date(s * 1000)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputValueToUnix(value: string): number | undefined {
  if (!value) return undefined
  const ts = new Date(`${value}T00:00:00`).getTime()
  if (!Number.isFinite(ts)) return undefined
  return Math.floor(ts / 1000)
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
    staffPicks: search.staffPicks === true || search.staffPicks === 'true' ? true : undefined,
    hasBanner: search.hasBanner === true || search.hasBanner === 'true' ? true : undefined,
    minEntrants: parseOptionalInt(search.minEntrants),
    after: parseOptionalInt(search.after),
    before: parseOptionalInt(search.before),
    game: typeof search.game === 'string' && search.game ? search.game : undefined,
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

function isStatusFilter(v: unknown): v is StatusFilter {
  return v === 'all' || v === 'upcoming' || v === 'live' || v === 'past'
}

function TournamentsPage() {
  const {
    q, country, state, online, status, featured, regOpen,
    staffPicks, hasBanner, minEntrants, after, before, game, sort,
  } = Route.useSearch()
  const navigate = useNavigate({ from: '/tournaments' })

  const [searchInput, setSearchInput] = useState(q ?? '')
  const [minEntrantsInput, setMinEntrantsInput] = useState(minEntrants ? String(minEntrants) : '')

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

  const activeAdvancedCount = useMemo(() => {
    let count = 0
    if (staffPicks) count++
    if (hasBanner) count++
    if (minEntrants && minEntrants > 0) count++
    if (after && after > 0) count++
    if (before && before > 0) count++
    return count
  }, [staffPicks, hasBanner, minEntrants, after, before])

  const activeBasicCount = useMemo(() => {
    let count = 0
    if (q) count++
    if (country) count++
    if (state && country === 'US') count++
    if (game) count++
    if (online && online !== 'all') count++
    if (status && status !== 'all') count++
    if (featured) count++
    if (regOpen) count++
    return count
  }, [q, country, state, game, online, status, featured, regOpen])

  const totalActiveFilterCount = activeBasicCount + activeAdvancedCount

  const [advancedOpen, setAdvancedOpen] = useState(activeAdvancedCount > 0)

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
    staffPicks,
    hasBanner,
    minEntrants,
    after,
    before,
    game,
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
      { rootMargin: THRESHOLDS.LAZY_LOAD_ROOT_MARGIN },
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

  function handleMinEntrantsChange(value: string) {
    setMinEntrantsInput(value)
    const n = Number(value)
    updateSearch({ minEntrants: Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined })
  }

  function handleClearFilters() {
    if (totalActiveFilterCount === 0) return
    if (!window.confirm(`Clear all ${totalActiveFilterCount} active filter${totalActiveFilterCount === 1 ? '' : 's'}?`)) return
    setSearchInput('')
    setMinEntrantsInput('')
    navigate({
      search: (prev) => ({ sort: prev.sort }),
      replace: true,
    })
  }

  const afterValue = unixToDateInputValue(after)
  const beforeValue = unixToDateInputValue(before)

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
        <div className={styles.searchInputWrap}>
          <span className={styles.inputLeadingIcon}><IconSearch /></span>
          <input
            type="text"
            className={`${styles.searchInput} ${styles.searchInputWithIcon}`}
            placeholder="Search tournaments..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <FilterSelect
          className={styles.filterSelect}
          value={country ?? ''}
          options={countrySelectOptions}
          leadingIcon={<IconGlobe />}
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
            leadingIcon={<IconMapPin />}
            onChange={(v) => updateSearch({ state: v || undefined })}
          />
        )}
        <FilterSelect
          className={styles.filterSelect}
          value={game ?? ''}
          options={GAME_SELECT_OPTIONS}
          leadingIcon={<IconGamepad />}
          aria-label="Filter by videogame"
          onChange={(v) => updateSearch({ game: v || undefined })}
        />
        <div className={styles.sortGroup}>
          <FilterSelect
            className={`${styles.filterSelect} ${styles.sortSelect}`}
            value={sortBy}
            options={SORT_SELECT_OPTIONS}
            leadingIcon={<IconSort />}
            aria-label="Sort tournaments"
            onChange={(v) => updateSearch({ sort: v !== 'startAt desc' ? v : undefined })}
          />
        </div>
      </div>

      <div className={styles.filterRow}>
        <FilterToggle
          value={onlineFilter}
          onChange={(v) => updateSearch({ online: v !== 'all' ? v : undefined })}
        />
        <div className={styles.statusToggle}>
          {(['all', 'upcoming', 'live', 'past'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.statusOption} ${statusFilter === opt ? styles.statusActive : ''}`}
              onClick={() => updateSearch({ status: opt !== 'all' ? opt : undefined })}
            >
              {opt === 'all' ? 'All' : opt === 'upcoming' ? 'Upcoming' : opt === 'live' ? 'Live' : 'Past'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.checkPill} ${featured ? styles.checkPillActive : ''}`}
          onClick={() => updateSearch({ featured: !featured || undefined })}
        >
          <IconStar />
          Featured
        </button>
        <button
          type="button"
          className={`${styles.checkPill} ${regOpen ? styles.checkPillActive : ''}`}
          onClick={() => updateSearch({ regOpen: !regOpen || undefined })}
        >
          <IconClock />
          Reg Open
        </button>
        <div className={styles.rightActions}>
          <button
            type="button"
            className={`${styles.filtersToggle} ${advancedOpen ? styles.filtersToggleOpen : ''}`}
            aria-expanded={advancedOpen}
            aria-controls="tournaments-advanced-panel"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            <IconSliders />
            <span>Advanced</span>
            {activeAdvancedCount > 0 && (
              <span className={styles.filtersBadge}>{activeAdvancedCount}</span>
            )}
            <svg
              className={`${styles.filtersChevron} ${advancedOpen ? styles.filtersChevronOpen : ''}`}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={`${styles.filtersToggle} ${styles.clearFiltersButton}`}
            onClick={handleClearFilters}
            disabled={totalActiveFilterCount === 0}
            aria-label={
              totalActiveFilterCount === 0
                ? 'No active filters to clear'
                : `Clear all ${totalActiveFilterCount} active filters`
            }
          >
            <IconX />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {advancedOpen && (
        <div id="tournaments-advanced-panel" className={styles.filtersPanel}>
          <div className={styles.filterRow}>
            <div className={styles.numericInputWrap}>
              <span className={styles.inputLeadingIcon}><IconUsers /></span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className={`${styles.numericInput} ${styles.inputWithIcon}`}
                placeholder="Min players"
                aria-label="Minimum entrants per event"
                value={minEntrantsInput}
                onChange={(e) => handleMinEntrantsChange(e.target.value)}
              />
            </div>
            <div className={styles.dateField}>
              <span className={styles.fieldLabel}>From</span>
              <div className={styles.dateInputWrap}>
                <span className={styles.inputLeadingIcon}><IconCalendar /></span>
                <input
                  type="date"
                  className={`${styles.dateInput} ${styles.inputWithIcon}`}
                  aria-label="Tournaments starting on or after"
                  value={afterValue}
                  onChange={(e) => updateSearch({ after: dateInputValueToUnix(e.target.value) })}
                />
              </div>
            </div>
            <div className={styles.dateField}>
              <span className={styles.fieldLabel}>To</span>
              <div className={styles.dateInputWrap}>
                <span className={styles.inputLeadingIcon}><IconCalendar /></span>
                <input
                  type="date"
                  className={`${styles.dateInput} ${styles.inputWithIcon}`}
                  aria-label="Tournaments starting on or before"
                  value={beforeValue}
                  onChange={(e) => updateSearch({ before: dateInputValueToUnix(e.target.value) })}
                />
              </div>
            </div>
            <button
              type="button"
              className={`${styles.checkPill} ${staffPicks ? styles.checkPillActive : ''}`}
              onClick={() => updateSearch({ staffPicks: !staffPicks || undefined })}
            >
              <IconShield />
              Staff Picks
            </button>
            <button
              type="button"
              className={`${styles.checkPill} ${hasBanner ? styles.checkPillActive : ''}`}
              onClick={() => updateSearch({ hasBanner: !hasBanner || undefined })}
            >
              <IconImage />
              Has Banner
            </button>
          </div>
        </div>
      )}

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
