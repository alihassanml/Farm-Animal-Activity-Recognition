import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Tone = 'neutral' | 'danger' | 'success'

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  to?: string
  /** Optional small visual under the number (bar, sparkline). */
  children?: ReactNode
}

/** One KPI: label, big Geist Mono number, short hint. Danger states colour the number. */
export function StatCard({ label, value, hint, tone = 'neutral', to, children }: Props) {
  const body = (
    <>
      <p className="text-sm text-secondary">{label}</p>
      <p className={`numeric mt-4 text-metric ${tone === 'danger' ? 'text-critical' : 'text-ink'}`}>{value}</p>
      {children && <div className="mt-4">{children}</div>}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </>
  )
  const cls = 'block min-w-0 rounded-md border border-line bg-surface p-6'
  return to ? (
    <Link to={to} className={`${cls} transition-colors duration-150 hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
