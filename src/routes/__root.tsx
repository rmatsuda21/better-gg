import { createRootRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../hooks/use-auth'
import { useCurrentUser } from '../hooks/use-current-user'
import { UserMenu } from '../components/UserMenu/UserMenu'
import { LoginModal } from '../components/LoginModal/LoginModal'
import styles from './__root.module.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const matches = useMatches()
  const isHome = matches[matches.length - 1]?.id === '/'
  const { isAuthenticated } = useAuth()
  const [showLogin, setShowLogin] = useState(false)

  // Fetch current user profile when authenticated
  useCurrentUser()

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {isHome ? (
            <h1 className={styles.title}>better.gg</h1>
          ) : (
            <Link to="/" className={styles.titleLink}>
              <h1 className={styles.title}>better.gg</h1>
            </Link>
          )}
        </div>
        <div className={styles.headerRight}>
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <button className={styles.connectButton} onClick={() => setShowLogin(true)}>
              Connect
            </button>
          )}
        </div>
      </header>
      <Outlet />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  )
}
