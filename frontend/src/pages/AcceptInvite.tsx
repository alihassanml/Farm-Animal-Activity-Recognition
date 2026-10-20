import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { inviteApi } from '../api/endpoints'
import { Logo } from '../components/layout/Logo'
import { Button, ButtonLink } from '../components/ui/Button'
import { ErrorState, Loading, Notice } from '../components/ui/States'
import { useAuth } from '../context/auth'
import { useAsync } from '../hooks/useAsync'

export default function AcceptInvite() {
  const { token = '' } = useParams()
  const { me, ready, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const invite = useAsync(() => inviteApi.getPublic(token), [token])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const here = `/invite/${encodeURIComponent(token)}`

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const ws = await inviteApi.accept(token)
      await refresh()
      navigate(`/w/${ws.id}/dashboard`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  let body
  if (!ready || invite.loading) {
    body = <Loading />
  } else if (invite.error || !invite.data) {
    body = <ErrorState message={invite.error ?? 'This invite link is not valid.'} />
  } else {
    const inv = invite.data
    const roleText = inv.role === 'admin' ? 'an admin' : 'a member'
    if (inv.status !== 'pending') {
      body = (
        <>
          <h1 className="text-[22px]">Invite {inv.status}</h1>
          <p className="mt-2 text-muted">
            This invite to <strong className="text-ink">{inv.workspace_name}</strong> can no longer be used. Ask a workspace admin for a new
            link.
          </p>
          <ButtonLink to="/app" variant="secondary" className="mt-6">
            Go to the app
          </ButtonLink>
        </>
      )
    } else {
      body = (
        <>
          <h1 className="text-[22px]">Join {inv.workspace_name}</h1>
          <p className="mt-2 text-muted">
            You’ve been invited to join as {roleText}. The invite is for <strong className="text-ink">{inv.email}</strong>.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {error && <Notice>{error}</Notice>}
            {!me ? (
              <>
                <ButtonLink to={`/signup?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`}>Sign up to join</ButtonLink>
                <ButtonLink to={`/login?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`} variant="secondary">
                  I already have an account
                </ButtonLink>
              </>
            ) : me.user.email !== inv.email ? (
              <>
                <Notice tone="warning">
                  You’re logged in as {me.user.email}. Log out and use {inv.email} to accept this invite.
                </Notice>
                <Button variant="secondary" onClick={() => logout()}>
                  Log out
                </Button>
              </>
            ) : (
              <Button onClick={accept} loading={busy}>
                Join workspace
              </Button>
            )}
          </div>
        </>
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link to="/" className="mb-8" aria-label="Farm Activity home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 sm:p-8">{body}</div>
    </div>
  )
}
