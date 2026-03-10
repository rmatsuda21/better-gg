import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/use-auth'
import styles from './auth.callback.module.css'

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || undefined,
  }),
  component: AuthCallback,
})

function AuthCallback() {
  const { code } = Route.useSearch()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(
    code ? null : 'No authorization code received',
  )
  const didRun = useRef(false)

  useEffect(() => {
    if (!code || didRun.current) return
    didRun.current = true

    const redirectUri = `${window.location.origin}/auth/callback`

    fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? `Token exchange failed (${res.status})`)
        }
        return res.json()
      })
      .then((data) => {
        login(data.access_token, data.refresh_token, data.expires_in)
        navigate({ to: '/' })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      })
  }, [code, login, navigate])

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h2 className={styles.title}>Authentication Failed</h2>
          <p className={styles.message}>{error}</p>
          <button className={styles.button} onClick={() => navigate({ to: '/' })}>
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.spinner} />
        <p className={styles.message}>Connecting to start.gg...</p>
      </div>
    </div>
  )
}
