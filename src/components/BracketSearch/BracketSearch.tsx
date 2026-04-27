import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import type { BracketEntrantInfo } from '../../lib/bracket-utils'
import { LAYOUT, THRESHOLDS } from '../../lib/constants'
import styles from './BracketSearch.module.css'

interface BracketSearchProps {
  entrants: BracketEntrantInfo[]
  onSelect: (entrant: BracketEntrantInfo) => void
  onClear: () => void
  hasSelection: boolean
}

const MAX_RESULTS = LAYOUT.MAX_BRACKET_SEARCH_RESULTS

export function BracketSearch({ entrants, onSelect, onClear, hasSelection }: BracketSearchProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const showMultiPool = useMemo(() => {
    const pools = new Set(entrants.map(e => e.phaseGroupId))
    return pools.size > 1
  }, [entrants])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < THRESHOLDS.MIN_BRACKET_SEARCH_LENGTH) return []
    return entrants
      .filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.prefix && e.prefix.toLowerCase().includes(q))
      )
      .slice(0, MAX_RESULTS)
  }, [entrants, query])

  const showDropdown = isOpen && query.trim().length >= 1

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const selectEntrant = useCallback(
    (entrant: BracketEntrantInfo) => {
      setIsOpen(false)
      setQuery('')
      onSelect(entrant)
    },
    [onSelect],
  )

  function handleKeyDown(e: KeyboardEvent) {
    if (!showDropdown) {
      if (e.key === 'Escape' && hasSelection) {
        onClear()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i < filtered.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i > 0 ? i - 1 : filtered.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault()
      selectEntrant(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  function handleClear() {
    setQuery('')
    setIsOpen(false)
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
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
          if (query.trim().length >= 1) setIsOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search player in bracket..."
        autoComplete="off"
      />
      {hasSelection && (
        <button
          className={styles.clearBtn}
          onClick={handleClear}
          title="Clear search"
        >
          &times;
        </button>
      )}
      {showDropdown && (
        <div className={styles.dropdown}>
          {filtered.length === 0 ? (
            <div className={styles.emptyMessage}>No players found</div>
          ) : (
            filtered.map((entrant, index) => (
              <div
                key={entrant.entrantId}
                className={`${styles.resultItem} ${index === activeIndex ? styles.active : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectEntrant(entrant)
                }}
              >
                <span className={styles.seedNum}>
                  {entrant.seedNum ?? '—'}
                </span>
                <span className={styles.entrantName}>
                  {entrant.prefix && (
                    <>
                      <span className={styles.prefix}>{entrant.prefix}</span>
                      <span className={styles.prefix}> | </span>
                    </>
                  )}
                  {entrant.name}
                </span>
                {showMultiPool && entrant.poolLabel && (
                  <span className={styles.poolBadge}>
                    Pool {entrant.poolLabel}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
