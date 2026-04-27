import { createRootRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../hooks/use-auth'
import { refreshAuthTokens } from '../lib/auth'
import { useCurrentUser } from '../hooks/use-current-user'
import { UserMenu } from '../components/UserMenu/UserMenu'
import { MobileNav } from '../components/MobileNav/MobileNav'
import styles from './__root.module.css'

const LazyLoginModal = lazy(() =>
  import('../components/LoginModal/LoginModal').then((m) => ({
    default: m.LoginModal,
  })),
)

const LazyCommandPalette = lazy(() =>
  import('../components/CommandPalette/CommandPalette').then((m) => ({
    default: m.CommandPalette,
  })),
)

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const matches = useMatches()
  const isHome = matches[matches.length - 1]?.id === '/'
  const { isAuthenticated, isExpired, logout } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Fetch current user profile when authenticated
  useCurrentUser()

  // Proactively refresh expired tokens on mount
  useEffect(() => {
    if (!isExpired) return
    refreshAuthTokens().then((success) => {
      if (!success) logout()
    })
  }, [isExpired, logout])

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Track scroll for header border
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const openPalette = useCallback(() => setShowPalette(true), [])
  const closePalette = useCallback(() => setShowPalette(false), [])
  const openLogin = useCallback(() => setShowLogin(true), [])
  const closeLogin = useCallback(() => setShowLogin(false), [])

  return (
    <div className={styles.app}>
      <div ref={sentinelRef} className={styles.sentinel} />
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <div className={styles.headerLeft}>
          {isHome ? (
            <div className={styles.titleGroup}>
              <img src="/logo.svg" alt="" className={styles.logo} />
              <h1 className={styles.title}>better.gg</h1>
            </div>
          ) : (
            <Link to="/" className={`${styles.titleLink} ${styles.titleGroup}`}>
              <img src="/logo.svg" alt="" className={styles.logo} />
              <h1 className={styles.title}>better.gg</h1>
            </Link>
          )}
          <Link
            to="/tournaments"
            className={styles.navLink}
            activeProps={{ className: styles.navLinkActive }}
          >
            Tournaments
          </Link>
          <Link
            to="/players"
            className={styles.navLink}
            activeProps={{ className: styles.navLinkActive }}
          >
            Players
          </Link>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.searchButton}
            onClick={openPalette}
            aria-label="Search"
            title="Search (⌘K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span className={styles.searchKbd}>⌘K</span>
          </button>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button className={styles.connectButton} onClick={openLogin}>
              Connect
            </button>
          )}
        </div>
      </header>
      <Outlet />
      <MobileNav onSearchOpen={openPalette} onLoginOpen={openLogin} />
      <Suspense fallback={null}>
        {showLogin && <LazyLoginModal isOpen={showLogin} onClose={closeLogin} />}
      </Suspense>
      <Suspense fallback={null}>
        {showPalette && <LazyCommandPalette isOpen={showPalette} onClose={closePalette} />}
      </Suspense>
    </div>
  )
}
