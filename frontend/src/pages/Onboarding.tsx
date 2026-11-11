import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { workspaceApi } from '../api/endpoints'
import { PublicShell, ShellTitle } from '../components/layout/PublicShell'
import { Button, ButtonLink } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Notice } from '../components/ui/States'
import { useAuth } from '../context/auth'
import { getLastWorkspace } from '../lib/storage'

/** /app: open the last used workspace, or onboarding if the user has none. */
export function AppHome() {
  const { me } = useAuth()
  const list = me?.workspaces ?? []
  if (list.length === 0) return <Navigate to="/onboarding" replace />
  const last = getLastWorkspace()
  const target = list.find((w) => w.id === last) ?? list[0]
  return <Navigate to={`/w/${target.id}/dashboard`} replace />
}

export default function Onboarding() {
  const { me, refresh } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const first = (me?.workspaces.length ?? 0) === 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const ws = await workspaceApi.create(name)
      await refresh()
      navigate(`/w/${ws.id}/dashboard`, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <PublicShell>
      <div>
        <ShellTitle
          title={first ? `Welcome, ${me?.user.name.split(' ')[0] ?? ''}` : 'New workspace'}
          subtitle={
            first
              ? 'Create a workspace for your farm. You’ll be its admin and can invite your team later.'
              : 'Create another workspace, for example for a second farm or barn.'
          }
        />
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Notice>{error}</Notice>}
          <Input label="Workspace name" placeholder="e.g. Green Valley Dairy" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              Create workspace
            </Button>
            {!first && (
              <ButtonLink to="/app" variant="secondary">
                Cancel
              </ButtonLink>
            )}
          </div>
        </form>
        {first && (
          <p className="mt-8 text-sm text-secondary">
            Were you invited to a team? Open the invite link you received instead.
          </p>
        )}
      </div>
    </PublicShell>
  )
}
