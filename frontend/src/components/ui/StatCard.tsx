import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Tone = 'neutral' | 'danger' | 'success'

const ICON_TONE: Record<Tone, string> = {
  neutral: 'bg-primary-soft text-primary',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
}

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: Tone
  to?: string
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', to }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-lg ${ICON_TONE[tone]}`}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className={`mt-4 text-[30px] leading-none font-semibold tracking-tight tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-ink'}`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </>
  )
  const cls = 'block rounded-lg border border-line bg-surface px-5 py-4 shadow-card'
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
