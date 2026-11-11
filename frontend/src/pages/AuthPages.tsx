import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { PublicShell, ShellTitle } from '../components/layout/PublicShell'
import { FeedFrame } from '../components/marketing/FeedFrame'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Notice } from '../components/ui/States'
import { useAuth } from '../context/auth'

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <PublicShell
      aside={
        <div>
          <FeedFrame eager={false} />
          <p className="mt-4 text-xs text-muted">Every cow detected, numbered and labelled, straight from the barn camera.</p>
        </div>
      }
    >
      <ShellTitle title={title} subtitle={subtitle} />
      {children}
      <p className="mt-8 text-sm text-secondary">{footer}</p>
    </PublicShell>
  )
}

function withNext(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path
}

export function Login() {
  const { login } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password) // GuestOnly then redirects to ?next=
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see how your herd is doing."
      footer={
        <>
          New here?{' '}
          <Link to={withNext('/signup', next)} className="link">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Notice>{error}</Notice>}
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={busy} disabled={!email || !password} className="mt-2 w-full">
          Log in
        </Button>
      </form>
    </AuthShell>
  )
}

export function Signup() {
  const { signup } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await signup(name, email, password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up a workspace for your farm in a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to={withNext('/login', next)} className="link">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error && <Notice>{error}</Notice>}
        <Input label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={busy} disabled={!name.trim() || !email || !password} className="mt-2 w-full">
          Sign up
        </Button>
      </form>
    </AuthShell>
  )
}
