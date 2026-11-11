import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { inviteApi } from '../api/endpoints'
import { PublicShell } from '../components/layout/PublicShell'
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
          <h1 className="text-h3">Invite {inv.status}</h1>
          <p className="mt-2 text-secondary">
            This invite to <strong className="text-ink">{inv.workspace_name}</strong> can no longer be used. Ask a workspace admin for a new
            link.
          </p>
          <ButtonLink to="/app" variant="secondary" className="mt-8">
            Go to the app
          </ButtonLink>
        </>
      )
    } else {
      body = (
        <>
          <h1 className="text-h3">Join {inv.workspace_name}</h1>
          <p className="mt-2 text-secondary">
            You’ve been invited to join as {roleText}. The invite is for <strong className="text-ink">{inv.email}</strong>.
          </p>
          <div className="mt-8 flex flex-col gap-3">
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
    <PublicShell>
      <div>{body}</div>
    </PublicShell>
  )
}
