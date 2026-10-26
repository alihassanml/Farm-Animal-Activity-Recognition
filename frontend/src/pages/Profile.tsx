import { useState, type FormEvent } from 'react'
import { errorMessage } from '../api/client'
import { authApi } from '../api/endpoints'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { Notice } from '../components/ui/States'
import { useAuth } from '../context/auth'

type Msg = { tone: 'success' | 'danger'; text: string } | null

export default function Profile() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Details />
      <Password />
    </div>
  )
}

function Details() {
  const { me, setMe } = useAuth()
  const [name, setName] = useState(me?.user.name ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      setMe(await authApi.updateProfile(name))
      setMsg({ tone: 'success', text: 'Your name was saved.' })
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Your details" />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Input label="Name" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" value={me?.user.email ?? ''} disabled hint="Your email can’t be changed." />
          <div>
            <Button type="submit" loading={busy} disabled={!name.trim() || name.trim() === me?.user.name}>
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function Password() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (next.length < 8) return setMsg({ tone: 'danger', text: 'The new password must be at least 8 characters.' })
    if (next !== confirm) return setMsg({ tone: 'danger', text: 'The new passwords don’t match.' })
    setBusy(true)
    setMsg(null)
    try {
      await authApi.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setMsg({ tone: 'success', text: 'Your password was changed.' })
    } catch (err) {
      setMsg({ tone: 'danger', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Change password" />
      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Input label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Input label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div>
            <Button type="submit" loading={busy} disabled={!current || !next || !confirm}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
