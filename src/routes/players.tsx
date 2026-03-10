import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useFilteredPlayers } from '../hooks/use-filtered-players'
import { usePlayerCountries } from '../hooks/use-player-search'
import { useCharacters } from '../hooks/use-characters'
import { buildCharacterMap, getCharacterStockIcon } from '../lib/character-utils'
import { countryCodeToFlag } from '../lib/country-utils'
import { Skeleton } from '../components/Skeleton/Skeleton'
import type { PlayerRecord } from '../lib/player-search-types'
import styles from './players.module.css'

const ULTIMATE_VIDEOGAME_ID = '1386'

interface PlayersSearch {
  q?: string
  country?: string
  character?: number
  page?: number
}

export const Route = createFileRoute('/players')({
  validateSearch: (search: Record<string, unknown>): PlayersSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    country:
      typeof search.country === 'string' && search.country
        ? search.country
        : undefined,
    character: search.character ? Number(search.character) : undefined,
    page: search.page ? Number(search.page) : undefined,
  }),
  component: PlayersPage,
})

function PlayersPage() {
  const { q, country, character, page } = Route.useSearch()
  const navigate = useNavigate({ from: '/players' })

  const [searchInput, setSearchInput] = useState(q ?? '')

  const { players, total, totalPages, page: currentPage, isLoading } =
    useFilteredPlayers({
      query: searchInput,
      country,
      characterId: character,
      page: page ?? 1,
    })

  const { data: countriesData } = usePlayerCountries()
  const { data: charactersData } = useCharacters(ULTIMATE_VIDEOGAME_ID)
  const characterMap = useMemo(
    () => buildCharacterMap(charactersData?.videogame?.characters ?? null),
    [charactersData],
  )

  const characterOptions = useMemo(() => {
    const chars = charactersData?.videogame?.characters
    if (!chars) return []
    return chars
      .filter((c): c is { id: string; name: string } => !!c?.id && !!c?.name)
      .map((c) => ({ id: Number(c.id), name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [charactersData])

  function updateSearch(updates: Partial<PlayersSearch>) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
        page: 'page' in updates ? updates.page : 1,
      }),
    })
  }

  function handleSearchChange(value: string) {
    setSearchInput(value)
    updateSearch({ q: value || undefined })
  }

  const start = (currentPage - 1) * 50 + 1
  const end = Math.min(currentPage * 50, total)

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Players</h1>
        {!isLoading && (
          <span className={styles.countBadge}>
            {total.toLocaleString()}
          </span>
        )}
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search players..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={country ?? ''}
          onChange={(e) =>
            updateSearch({ country: e.target.value || undefined })
          }
        >
          <option value="">All regions</option>
          {(countriesData ?? []).map((c) => (
            <option key={c} value={c}>
              {countryCodeToFlag(c) ?? ''} {c}
            </option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={character ?? ''}
          onChange={(e) =>
            updateSearch({
              character: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">All characters</option>
          {characterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className={styles.skeletons}>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} width="100%" height={44} borderRadius={6} />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className={styles.noResults}>No players found</div>
      ) : (
        <>
          <div className={styles.resultsSummary}>
            Showing {start}&ndash;{end} of {total.toLocaleString()} players
          </div>
          <div className={styles.playerList}>
            <div className={styles.playerRowHeader}>
              <span>Player</span>
              <span>Characters</span>
              <span>Tournaments</span>
            </div>
            {players.map((p) => (
              <PlayerRow
                key={p.pid}
                player={p}
                characterMap={characterMap}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageButton}
                disabled={currentPage <= 1}
                onClick={() => updateSearch({ page: currentPage - 1 })}
              >
                Prev
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
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

function PlayerRow({
  player,
  characterMap,
}: {
  player: PlayerRecord
  characterMap: Map<number, string>
}) {
  const flag = player.cc ? countryCodeToFlag(player.cc) : null

  return (
    <Link
      to="/player/$playerId"
      params={{ playerId: player.pid }}
      className={styles.playerRow}
    >
      <span className={styles.playerName}>
        {player.pfx && <span className={styles.prefix}>{player.pfx}</span>}
        {player.tag}
        {flag && <span className={styles.flag}>{flag}</span>}
      </span>
      <span className={styles.characters}>
        {player.chars.slice(0, 3).map((ch) => (
          <span
            key={ch.id}
            className={`${styles.charTag} ${styles[ch.role]}`}
          >
            <img
              src={getCharacterStockIcon(ch.id)}
              alt=""
              className={styles.charIcon}
            />
            {characterMap.get(ch.id) ?? `#${ch.id}`}
          </span>
        ))}
      </span>
      <span className={styles.tournamentCount}>{player.tc}</span>
    </Link>
  )
}
