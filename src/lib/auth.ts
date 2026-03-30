const STORAGE_KEYS = {
  token: 'better_gg_token',
  refresh: 'better_gg_refresh',
  expires: 'better_gg_expires',
  user: 'better_gg_user',
} as const

export interface AuthUser {
  id: string
  slug: string
  discriminator: string
  name: string | null
  gamerTag: string | null
  profileImageUrl: string | null
  playerId: string | null
}

export interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  user: AuthUser | null
  isAuthenticated: boolean
}

type Listener = () => void
const listeners = new Set<Listener>()

// Cached snapshot — `useSyncExternalStore` requires referential stability
// when nothing has changed, otherwise it triggers infinite re-renders.
let cachedSnapshot: AuthState | null = null

function invalidateAndNotify() {
  cachedSnapshot = null
  for (const listener of listeners) {
    listener()
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refresh)
}

export function setAuthTokens(accessToken: string, refreshToken: string, expiresIn: number) {
  localStorage.setItem(STORAGE_KEYS.token, accessToken)
  localStorage.setItem(STORAGE_KEYS.refresh, refreshToken)
  localStorage.setItem(STORAGE_KEYS.expires, String(Date.now() + expiresIn * 1000))
  invalidateAndNotify()
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEYS.token)
  localStorage.removeItem(STORAGE_KEYS.refresh)
  localStorage.removeItem(STORAGE_KEYS.expires)
  localStorage.removeItem(STORAGE_KEYS.user)
  invalidateAndNotify()
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setAuthUser(user: AuthUser) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  invalidateAndNotify()
}

export function isTokenExpired(): boolean {
  const expires = localStorage.getItem(STORAGE_KEYS.expires)
  if (!expires) return true
  return Date.now() >= Number(expires)
}

export function getEffectiveToken(): string {
  const userToken = getAuthToken()
  if (userToken) return userToken
  return import.meta.env.VITE_START_GG_TOKEN ?? ''
}

let refreshPromise: Promise<boolean> | null = null

export async function refreshAuthTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise

  const refresh = getRefreshToken()
  if (!refresh) {
    clearAuth()
    return false
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!res.ok) {
        clearAuth()
        return false
      }
      const data = await res.json()
      setAuthTokens(data.access_token, data.refresh_token, data.expires_in)
      return true
    } catch {
      clearAuth()
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): AuthState {
  if (!cachedSnapshot) {
    const token = getAuthToken()
    const userRaw = localStorage.getItem(STORAGE_KEYS.user)
    const expiresRaw = localStorage.getItem(STORAGE_KEYS.expires)
    cachedSnapshot = {
      token,
      refreshToken: getRefreshToken(),
      expiresAt: expiresRaw ? Number(expiresRaw) : null,
      user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
      isAuthenticated: !!token,
    }
  }
  return cachedSnapshot
}
