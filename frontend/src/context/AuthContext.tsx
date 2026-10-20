import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setUnauthorizedHandler } from '../api/client'
import { authApi } from '../api/endpoints'
import type { Me } from '../api/types'
import { AuthContext, type AuthValue } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const m = await authApi.me()
      setMeState(m)
      return m
    } catch {
      setMeState(null)
      return null
    }
  }, [])

  useEffect(() => {
    authApi
      .me()
      .then(setMeState, () => setMeState(null))
      .finally(() => setReady(true))
    setUnauthorizedHandler(() => setMeState(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      me,
      ready,
      refresh,
      setMe: setMeState,
      login: async (email, password) => {
        const m = await authApi.login(email, password)
        setMeState(m)
        return m
      },
      signup: async (name, email, password) => {
        const m = await authApi.signup(name, email, password)
        setMeState(m)
        return m
      },
      logout: async () => {
        try {
          await authApi.logout()
        } finally {
          setMeState(null)
        }
      },
    }),
    [me, ready, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
