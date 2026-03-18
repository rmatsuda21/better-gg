import { Link, useMatches } from '@tanstack/react-router'
import { useAuth } from '../../hooks/use-auth'
import styles from './MobileNav.module.css'

interface MobileNavProps {
  onSearchOpen: () => void
  onLoginOpen: () => void
}

export function MobileNav({ onSearchOpen, onLoginOpen }: MobileNavProps) {
  const matches = useMatches()
  const { isAuthenticated, user: authUser } = useAuth()
  const currentPath = matches[matches.length - 1]?.fullPath ?? '/'

  const isHome = currentPath === '/'
  const isTournaments = currentPath.startsWith('/tournament')
  const isProfile = currentPath.startsWith('/player')

  function handleProfileClick(e: React.MouseEvent) {
    if (!isAuthenticated) {
      e.preventDefault()
      onLoginOpen()
    }
  }

  const profileTo = isAuthenticated && authUser?.playerId
    ? '/player/$playerId'
    : '/'

  const profileParams = isAuthenticated && authUser?.playerId
    ? { playerId: authUser.playerId }
    : undefined

  return (
    <nav className={styles.nav}>
      <Link to="/" className={`${styles.item} ${isHome && !isTournaments && !isProfile ? styles.active : ''}`}>
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
        <span className={styles.label}>Home</span>
      </Link>

      <Link to="/tournaments" className={`${styles.item} ${isTournaments ? styles.active : ''}`}>
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-4.5A3.375 3.375 0 0 0 13.125 10.875h-2.25A3.375 3.375 0 0 0 7.5 14.25v4.5m9-9V3.375c0-.621-.504-1.125-1.125-1.125h-6.75c-.621 0-1.125.504-1.125 1.125V9.75" />
        </svg>
        <span className={styles.label}>Tournaments</span>
      </Link>

      <button className={styles.item} onClick={onSearchOpen} type="button">
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <span className={styles.label}>Search</span>
      </button>

      <Link
        to={profileTo}
        params={profileParams}
        className={`${styles.item} ${isProfile ? styles.active : ''}`}
        onClick={handleProfileClick}
      >
        <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
        <span className={styles.label}>Profile</span>
      </Link>
    </nav>
  )
}
