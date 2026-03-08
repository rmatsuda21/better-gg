import { useSyncExternalStore, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  subscribe,
  getSnapshot,
  setAuthTokens,
  clearAuth,
  isTokenExpired,
  getRefreshToken,
} from '../lib/auth'

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const queryClient = useQueryClient()

  const login = useCallback(
    (accessToken: string, refreshToken: string, expiresIn: number) => {
      setAuthTokens(accessToken, refreshToken, expiresIn)
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
    },
    [queryClient],
  )

  const logout = useCallback(() => {
    clearAuth()
    queryClient.invalidateQueries()
  }, [queryClient])

  const startOAuthFlow = useCallback(() => {
    const clientId = import.meta.env.VITE_START_GG_CLIENT_ID
    if (!clientId) {
      console.error('VITE_START_GG_CLIENT_ID not set')
      return
    }
    const redirectUri = `${window.location.origin}/auth/callback`
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'user.identity',
      redirect_uri: redirectUri,
    })
    window.location.href = `https://start.gg/oauth/authorize?${params}`
  }, [])

  const refreshTokens = useCallback(async () => {
    const refresh = getRefreshToken()
    if (!refresh) return false
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!res.ok) return false
      const data = await res.json()
      setAuthTokens(data.access_token, data.refresh_token, data.expires_in)
      return true
    } catch {
      return false
    }
  }, [])

  return {
    ...state,
    login,
    logout,
    startOAuthFlow,
    refreshTokens,
    isExpired: state.isAuthenticated && isTokenExpired(),
  }
}
