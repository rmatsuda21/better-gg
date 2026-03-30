import { useSyncExternalStore, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  subscribe,
  getSnapshot,
  setAuthTokens,
  clearAuth,
  isTokenExpired,
  refreshAuthTokens,
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
    return refreshAuthTokens()
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
