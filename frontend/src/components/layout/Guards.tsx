import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { safeNext } from '../../lib/nav'
import { Loading } from '../ui/States'

/** Routes that need a logged-in user. Sends others to /login?next=<current path>. */
export function RequireAuth() {
  const { me, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <Loading className="min-h-dvh" />
  if (!me) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

/** Login / sign-up pages: logged-in users continue to ?next= (or the app). */
export function GuestOnly() {
  const { me, ready } = useAuth()
  const [params] = useSearchParams()
  if (!ready) return <Loading className="min-h-dvh" />
  if (me) return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
}
