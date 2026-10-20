import { createContext, useContext } from 'react'
import type { Me } from '../api/types'

export interface AuthValue {
  me: Me | null
  ready: boolean // first session check finished
  login: (email: string, password: string) => Promise<Me>
  signup: (name: string, email: string, password: string) => Promise<Me>
  logout: () => Promise<void>
  refresh: () => Promise<Me | null>
  setMe: (me: Me) => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
