import { createRootRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import styles from './__root.module.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const matches = useMatches()
  const isHome = matches[matches.length - 1]?.id === '/'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        {isHome ? (
          <h1 className={styles.title}>better.gg</h1>
        ) : (
          <Link to="/" search={{ user: undefined }} className={styles.titleLink}>
            <h1 className={styles.title}>better.gg</h1>
          </Link>
        )}
        {isHome && (
          <p className={styles.subtitle}>
            Look up a player's recent tournaments on start.gg
          </p>
        )}
      </header>
      <Outlet />
    </div>
  )
}
