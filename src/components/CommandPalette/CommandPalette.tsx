import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import type { PlayerRecord } from '../../lib/player-search-types'
import type { TournamentSearchQuery } from '../../gql/graphql'
import styles from './CommandPalette.module.css'

type TournamentResult = NonNullable<NonNullable<NonNullable<TournamentSearchQuery['tournaments']>['nodes']>[number]>

const PlayerSearch = lazy(() =>
  import('../PlayerSearch/PlayerSearch').then((m) => ({
    default: m.PlayerSearch,
  })),
)

const TournamentSearch = lazy(() =>
  import('../TournamentSearch/TournamentSearch').then((m) => ({
    default: m.TournamentSearch,
  })),
)

type SearchTab = 'players' | 'tournaments'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [tab, setTab] = useState<SearchTab>('players')
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setTab((t) => (t === 'players' ? 'tournaments' : 'players'))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  if (!isOpen) return null

  function handlePlayerSelect(player: PlayerRecord) {
    onClose()
    navigate({ to: '/player/$playerId', params: { playerId: player.pid } })
  }

  function handlePlayerSearch(query: string, country?: string) {
    onClose()
    const search: Record<string, string> = { q: query }
    if (country) search.country = country
    navigate({ to: '/players', search })
  }

  function handleTournamentSelect(tournament: TournamentResult) {
    if (!tournament.id) return
    onClose()
    navigate({ to: '/tournament/$tournamentId', params: { tournamentId: String(tournament.id) } })
  }

  return createPortal(
    <div
      className={styles.overlay}
      ref={overlayRef}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'players' ? styles.tabActive : ''}`}
              onClick={() => setTab('players')}
              type="button"
            >
              Players
            </button>
            <button
              className={`${styles.tab} ${tab === 'tournaments' ? styles.tabActive : ''}`}
              onClick={() => setTab('tournaments')}
              type="button"
            >
              Tournaments
            </button>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>
          <Suspense fallback={null}>
            {tab === 'players' ? (
              <PlayerSearch onSelect={handlePlayerSelect} onSearch={handlePlayerSearch} inline autoFocus />
            ) : (
              <TournamentSearch onSelect={handleTournamentSelect} inline autoFocus />
            )}
          </Suspense>
        </div>
        <div className={styles.footer}>
          <span className={styles.hint}>
            <kbd className={styles.kbd}>Tab</kbd> to switch
          </span>
          <span className={styles.hint}>
            <kbd className={styles.kbd}>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
