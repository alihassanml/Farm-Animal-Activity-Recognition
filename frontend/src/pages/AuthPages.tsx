import { Check } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { Logo } from '../components/layout/Logo'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Field'
import { Notice } from '../components/ui/States'
import { useAuth } from '../context/auth'

const POINTS = [
  'Recognises standing, lying, eating, drinking and rumination',
  'Works with photos, videos and live barn cameras',
  'Alerts your team when herd behaviour looks unusual',
]

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="self-start" aria-label="Farm Activity home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[28px] tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-muted">{footer}</p>
        </div>
      </div>

      <aside className="hidden flex-col justify-between bg-forest p-12 text-white lg:flex">
        <p className="text-sm font-semibold text-forest-accent">Farm Activity</p>
        <div className="max-w-md">
          <h2 className="text-[32px] leading-tight tracking-[-0.02em]">Every cow, every hour, without walking the barn.</h2>
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-forest-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-forest-accent" strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-forest-muted">YOLO11 model trained on the CBVD-5 cattle behaviour dataset.</p>
      </aside>
    </div>
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
          <Link to={withNext('/signup', next)} className="font-medium text-primary hover:underline">
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
        <Button type="submit" loading={busy} disabled={!email || !password} className="mt-2 h-11 w-full">
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
          <Link to={withNext('/login', next)} className="font-medium text-primary hover:underline">
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
        <Button type="submit" loading={busy} disabled={!name.trim() || !email || !password} className="mt-2 h-11 w-full">
          Sign up
        </Button>
      </form>
    </AuthShell>
  )
}
