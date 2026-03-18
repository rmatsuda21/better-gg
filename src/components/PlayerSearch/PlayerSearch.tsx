import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { KeyboardEvent, FormEvent } from 'react'
import { usePlayerSearch, usePlayerCountries } from '../../hooks/use-player-search'
import { useCharacters } from '../../hooks/use-characters'
import { buildCharacterMap, getCharacterStockIcon } from '../../lib/character-utils'
import { countryCodeToFlag } from '../../lib/country-utils'
import { Skeleton } from '../Skeleton/Skeleton'
import type { PlayerRecord } from '../../lib/player-search-types'
import { FilterSelect } from '../FilterSelect/FilterSelect'
import styles from './PlayerSearch.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

interface PlayerSearchProps {
  onSelect: (player: PlayerRecord) => void
  onSearch?: (query: string, country?: string) => void
  inline?: boolean
}

export function PlayerSearch({ onSelect, onSearch, inline }: PlayerSearchProps) {
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { results, isLoading } = usePlayerSearch(query, country)
  const { data: countryList } = usePlayerCountries()
  const { data: charData } = useCharacters(ULTIMATE_VIDEOGAME_ID)
  const characterMap = buildCharacterMap(charData?.videogame?.characters)

  const countryOptions = useMemo(
    () => [
      { value: '', label: 'All regions' },
      ...(countryList ?? []).map((c) => ({
        value: c,
        label: `${countryCodeToFlag(c) ?? ''} ${c}`,
      })),
    ],
    [countryList],
  )

  const showDropdown = isOpen && query.trim().length >= 2

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

  const selectPlayer = useCallback(
    (player: PlayerRecord) => {
      setIsOpen(false)
      setQuery('')
      onSelect(player)
    },
    [onSelect],
  )

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && showDropdown && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault()
      selectPlayer(results[activeIndex])
      return
    }

    if (!showDropdown) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i < results.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i > 0 ? i - 1 : results.length - 1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`${styles.wrapper} ${inline ? styles.wrapperInline : ''}`} ref={wrapperRef}>
      <form
        className={styles.searchRow}
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (onSearch && query.trim()) {
            onSearch(query.trim(), country)
          }
        }}
      >
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
            if (query.trim().length >= 2) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by gamer tag"
          autoComplete="off"
        />
        <div className={styles.regionSelect}>
          <FilterSelect
            variant="hero"
            value={country ?? ''}
            options={countryOptions}
            onChange={(v) => {
              setCountry(v || undefined)
              setActiveIndex(-1)
            }}
          />
        </div>
      </form>
      {showDropdown && (
        <div className={`${styles.dropdown} ${inline ? styles.dropdownInline : ''}`}>
          {isLoading ? (
            <div className={styles.loadingRows}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} width="100%" height={50} borderRadius={6} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className={styles.emptyMessage}>No players found</div>
          ) : (
            results.map((player, index) => (
              <div
                key={player.pid}
                className={`${styles.resultItem} ${index === activeIndex ? styles.active : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectPlayer(player)
                }}
              >
                <div className={styles.resultLeft}>
                  <div className={styles.topLine}>
                    {player.pfx && (
                      <>
                        <span className={styles.prefix}>{player.pfx}</span>
                        <span className={styles.prefix}>|</span>
                      </>
                    )}
                    <span className={styles.gamerTag}>{player.tag}</span>
                    {player.cc && countryCodeToFlag(player.cc) && (
                      <span className={styles.flag}>
                        {countryCodeToFlag(player.cc)}
                      </span>
                    )}
                  </div>
                  {player.chars.length > 0 && (
                    <div className={styles.charLine}>
                      {player.chars.map((ch, ci) => (
                        <span key={ch.id} className={styles.charItem}>
                          {ci > 0 && <span className={styles.charSep}> · </span>}
                          <img
                            src={getCharacterStockIcon(ch.id)}
                            alt=""
                            className={styles.charIcon}
                          />
                          {characterMap.get(ch.id) ?? `Character ${ch.id}`}
                          {ch.role === 'co-main' && (
                            <span className={styles.coMain}> (co)</span>
                          )}
                          {ch.role === 'secondary' && (
                            <span className={styles.secondary}> (2nd)</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {player.disc && (
                  <span className={styles.discriminator}>{player.disc}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
