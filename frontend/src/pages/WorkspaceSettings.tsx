import { Check, Copy, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { dashboardApi, inviteApi, workspaceApi } from '../api/endpoints'
import type { Invite, Member, Role } from '../api/types'
import { SetupChecklist } from '../components/SetupChecklist'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, PageHeader } from '../components/ui/Card'
import { control, Input, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { EmptyState, ErrorState, Loading, Notice } from '../components/ui/States'
import { Table, Td, Th } from '../components/ui/Table'
import { useAuth } from '../context/auth'
import { useWorkspace } from '../context/workspace'
import { useAsync } from '../hooks/useAsync'
import { formatDate } from '../lib/format'

const inviteLink = (token: string) => `${window.location.origin}/invite/${token}`

export default function WorkspaceSettings() {
  const { isAdmin } = useWorkspace()
  const { workspace } = useWorkspace()
  const invites = useAsyncInvites(isAdmin)
  const summary = useAsync(() => dashboardApi.summary(workspace.id), [workspace.id])
  return (
    <div>
      <PageHeader title="Workspace settings" description={`Name, members and invites for ${workspace.name}.`} />
      <div className="flex flex-col gap-6">
      {summary.data && <SetupChecklist key={workspace.id} data={summary.data} />}
      <div className={`grid gap-6 ${isAdmin ? 'xl:grid-cols-2' : ''}`}>
        <General />
        {isAdmin && (
          <div id="invite" className="scroll-mt-20">
            <InviteForm onCreated={invites.reload} />
          </div>
        )}
      </div>
      <Members />
      {isAdmin && <PendingInvites state={invites} />}
      </div>
    </div>
  )
}

function useAsyncInvites(enabled: boolean) {
  const { workspace } = useWorkspace()
  return useAsync(() => (enabled ? inviteApi.list(workspace.id) : Promise.resolve([] as Invite[])), [workspace.id, enabled])
}

function General() {
  const { workspace, isAdmin } = useWorkspace()
  const { refresh } = useAuth()
  const [name, setName] = useState(workspace.name)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      await workspaceApi.rename(workspace.id, name)
      await refresh()
      setMsg({ tone: 'success', text: 'Workspace name saved.' })
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader title="General" />
      <CardBody>
        {isAdmin ? (
          <form onSubmit={submit} className="flex max-w-narrow flex-col gap-4">
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <Input label="Workspace name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <Button type="submit" loading={busy} disabled={!name.trim() || name.trim() === workspace.name}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <dl>
            <dt className="text-sm text-muted">Workspace name</dt>
            <dd className="mt-1 font-medium">{workspace.name}</dd>
          </dl>
        )}
      </CardBody>
    </Card>
  )
}

function Members() {
  const { workspace, isAdmin } = useWorkspace()
  const { me, refresh } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading, reload, mutate } = useAsync(() => workspaceApi.members(workspace.id), [workspace.id])
  const [actionError, setActionError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  async function setRole(m: Member, role: Role) {
    setActionError(null)
    try {
      const updated = await workspaceApi.setRole(workspace.id, m.user_id, role)
      mutate((list) => list.map((x) => (x.user_id === m.user_id ? updated : x)))
      if (m.user_id === me?.user.id) await refresh() // own role changed
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <Card>
      <CardHeader title="Members" description="Admins manage members, cameras, animals and alert rules. Members can view everything, run analyses and acknowledge alerts." />
      {actionError && (
        <div className="px-6 pt-4">
          <Notice>{actionError}</Notice>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorState message={error ?? ''} onRetry={reload} />
      ) : (
        <Table label="Members">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              {isAdmin && (
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.user_id}>
                <Td>
                  <p className="font-medium">
                    {m.name}
                    {m.user_id === me?.user.id && <span className="ml-2 text-sm font-normal text-muted">(you)</span>}
                  </p>
                  <p className="text-sm text-muted">{m.email}</p>
                </Td>
                <Td>
                  {isAdmin ? (
                    <select
                      aria-label={`Role for ${m.name}`}
                      value={m.role}
                      onChange={(e) => setRole(m, e.target.value as Role)}
                      className={`${control} h-9 pr-8`}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  ) : (
                    <Badge tone={m.role === 'admin' ? 'primary' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge>
                  )}
                </Td>
                <Td className="numeric whitespace-nowrap text-muted">{formatDate(m.joined_at)}</Td>
                {isAdmin && (
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>
                      {m.user_id === me?.user.id ? 'Leave' : 'Remove'}
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {removing && (
        <RemoveMember
          member={removing}
          self={removing.user_id === me?.user.id}
          onClose={() => setRemoving(null)}
          onRemoved={async () => {
            const self = removing.user_id === me?.user.id
            setRemoving(null)
            if (self) {
              await refresh()
              navigate('/app', { replace: true })
            } else reload()
          }}
        />
      )}
    </Card>
  )
}

function RemoveMember({ member, self, onClose, onRemoved }: { member: Member; self: boolean; onClose: () => void; onRemoved: () => void }) {
  const { workspace } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal
      open
      title={self ? 'Leave workspace' : 'Remove member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await workspaceApi.removeMember(workspace.id, member.user_id)
                onRemoved()
              } catch (e) {
                setError(errorMessage(e))
                setBusy(false)
              }
            }}
          >
            {self ? 'Leave' : 'Remove'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Notice>{error}</Notice>
        </div>
      )}
      <p>
        {self ? (
          <>You will lose access to <strong>{workspace.name}</strong>.</>
        ) : (
          <>
            Remove <strong>{member.name}</strong> from {workspace.name}? They will lose access straight away.
          </>
        )}
      </p>
    </Modal>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          window.prompt('Copy this link:', text)
        }
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}

function InviteForm({ onCreated }: { onCreated: () => void }) {
  const { workspace } = useWorkspace()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Invite | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setCreated(null)
    try {
      const inv = await inviteApi.create(workspace.id, email, role)
      setCreated(inv)
      setEmail('')
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader title="Invite people" description="Create an invite link and send it yourself. Links expire after 7 days and only work for the email you enter." />
      <CardBody className="flex flex-col gap-4">
        <form onSubmit={submit} className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
          <Button type="submit" loading={busy} disabled={!email}>
            Create invite link
          </Button>
        </form>
        {error && <Notice>{error}</Notice>}
        {created && (
          <div className="rounded-sm border border-line bg-surface-alt p-4">
            <p className="text-sm font-medium">Invite link for {created.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="numeric min-w-0 flex-1 truncate rounded-sm border border-line bg-surface px-3 py-2 text-xs">{inviteLink(created.token)}</code>
              <CopyButton text={inviteLink(created.token)} />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function PendingInvites({ state }: { state: ReturnType<typeof useAsyncInvites> }) {
  const { data, error, loading, reload, mutate } = state
  const [actionError, setActionError] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader title="Pending invites" />
      {actionError && (
        <div className="px-6 pt-4">
          <Notice>{actionError}</Notice>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorState message={error ?? ''} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No pending invites" />
      ) : (
        <Table label="Pending invites">
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Expires</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {data.map((inv) => (
              <tr key={inv.id}>
                <Td className="font-medium">{inv.email}</Td>
                <Td>{inv.role === 'admin' ? 'Admin' : 'Member'}</Td>
                <Td className="numeric whitespace-nowrap text-muted">{formatDate(inv.expires_at)}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <CopyButton text={inviteLink(inv.token)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Revoke invite for ${inv.email}`}
                      onClick={async () => {
                        setActionError(null)
                        try {
                          await inviteApi.revoke(inv.id)
                          mutate((list) => list.filter((x) => x.id !== inv.id))
                        } catch (e) {
                          setActionError(errorMessage(e))
                        }
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}
