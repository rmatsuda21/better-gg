import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { TournamentSearchQuery } from '../../gql/graphql'
import { useTournamentSearch } from '../../hooks/use-tournament-search'
import { parseStartGGUrl } from '../../lib/startgg-url'
import { formatDateRange } from '../../lib/format'
import { Skeleton } from '../Skeleton/Skeleton'
import { FilterToggle } from '../FilterToggle/FilterToggle'
import type { OnlineFilter } from '../FilterToggle/FilterToggle'
import { FilterSelect } from '../FilterSelect/FilterSelect'
import styles from './TournamentSearch.module.css'

type TournamentResult = NonNullable<NonNullable<NonNullable<TournamentSearchQuery['tournaments']>['nodes']>[number]>

const COUNTRY_OPTIONS = [
  { code: '', label: 'All regions' },
  { code: 'US', label: 'US' },
  { code: 'JP', label: 'JP' },
  { code: 'MX', label: 'MX' },
  { code: 'CA', label: 'CA' },
  { code: 'FR', label: 'FR' },
  { code: 'DE', label: 'DE' },
  { code: 'GB', label: 'GB' },
  { code: 'NL', label: 'NL' },
  { code: 'AU', label: 'AU' },
  { code: 'KR', label: 'KR' },
]

const COUNTRY_SELECT_OPTIONS = COUNTRY_OPTIONS.map((opt) => ({
  value: opt.code,
  label: opt.label,
}))

interface TournamentSearchProps {
  onSelect: (tournament: TournamentResult) => void
  onNavigate?: () => void
  inline?: boolean
  autoFocus?: boolean
}

export type { TournamentResult }

export function TournamentSearch({ onSelect, onNavigate, inline, autoFocus }: TournamentSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all')
  const [countryCode, setCountryCode] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const parsedUrl = parseStartGGUrl(query)

  const { results: rawResults, isLoading } = useTournamentSearch(parsedUrl ? '' : query, {
    countryCode: countryCode || undefined,
  })
  const results = rawResults.filter((t): t is TournamentResult => {
    if (t == null) return false
    if (onlineFilter === 'online') return t.isOnline === true
    if (onlineFilter === 'offline') return !t.isOnline
    return true
  })

  const showDropdown = isOpen && (parsedUrl || query.trim().length >= 3)

  // Auto-focus input when mounted with autoFocus
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const selectTournament = useCallback(
    (tournament: TournamentResult) => {
      setIsOpen(false)
      setQuery('')
      onSelect(tournament)
    },
    [onSelect],
  )

  const navigateToSlug = useCallback(
    (slug: string) => {
      setIsOpen(false)
      setQuery('')
      navigate({ to: '/tournament/$tournamentId', params: { tournamentId: slug } })
      onNavigate?.()
    },
    [navigate, onNavigate],
  )

  function handleKeyDown(e: KeyboardEvent) {
    if (!showDropdown) return

    if (e.key === 'Enter' && parsedUrl) {
      e.preventDefault()
      navigateToSlug(parsedUrl.slug)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault()
      selectTournament(results[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  function buildLocation(t: TournamentResult) {
    if (t.isOnline) return null
    const parts = [t.city, t.addrState, t.countryCode].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : null
  }

  return (
    <div className={`${styles.wrapper} ${inline ? styles.wrapperInline : ''}`} ref={wrapperRef}>
      <div className={styles.filterRow}>
        <FilterToggle value={onlineFilter} onChange={(v) => { setOnlineFilter(v); setActiveIndex(-1) }} />
      </div>
      <div className={styles.searchRow}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            if (query.trim().length >= 3) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search tournaments"
          autoComplete="off"
        />
        <div className={styles.regionSelect}>
          <FilterSelect
            variant="hero"
            value={countryCode}
            options={COUNTRY_SELECT_OPTIONS}
            onChange={(v) => {
              setCountryCode(v)
              setActiveIndex(-1)
            }}
          />
        </div>
      </div>
      {showDropdown && (
        <div className={`${styles.dropdown} ${inline ? styles.dropdownInline : ''}`}>
          {parsedUrl ? (
            <div
              className={`${styles.resultItem} ${styles.urlAction}`}
              onMouseDown={(e) => {
                e.preventDefault()
                navigateToSlug(parsedUrl.slug)
              }}
            >
              <div className={styles.urlActionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
              <div className={styles.resultInfo}>
                <span className={styles.resultName}>Go to tournament</span>
                <span className={styles.urlSlug}>{parsedUrl.slug}</span>
              </div>
            </div>
          ) : isLoading ? (
            <div className={styles.loadingRows}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} width="100%" height={50} borderRadius={6} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className={styles.emptyMessage}>No tournaments found</div>
          ) : (
            results.map((tournament, index) => {
              const imageUrl = tournament.images?.[0]?.url
              const location = buildLocation(tournament)

              return (
                <div
                  key={tournament.id ?? index}
                  className={`${styles.resultItem} ${index === activeIndex ? styles.active : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectTournament(tournament)
                  }}
                >
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className={styles.resultImage} />
                  ) : (
                    <div className={styles.resultImagePlaceholder}>T</div>
                  )}
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{tournament.name}</span>
                    <div className={styles.resultMeta}>
                      {tournament.startAt && tournament.endAt && (
                        <span>{formatDateRange(tournament.startAt, tournament.endAt)}</span>
                      )}
                      {tournament.isOnline ? (
                        <span className={`${styles.metaDot} ${styles.onlineBadge}`}>Online</span>
                      ) : location ? (
                        <span className={styles.metaDot}>{location}</span>
                      ) : null}
                      {tournament.numAttendees != null && tournament.numAttendees > 0 && (
                        <span className={styles.metaDot}>{tournament.numAttendees} attendees</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          {!parsedUrl && (
            <Link
              to="/tournaments"
              search={{
                q: query.trim() || undefined,
                country: countryCode || undefined,
                online: onlineFilter !== 'all' ? onlineFilter : undefined,
              }}
              className={styles.seeAllLink}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsOpen(false)}
            >
              See all results &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
