import { AlertCircle, Info, Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

export function Loading({ label = 'Loading', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-12 text-sm text-muted ${className}`}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-4 size-5 text-faint" strokeWidth={1.75} aria-hidden />}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-narrow text-sm text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <AlertCircle className="mb-4 size-5 text-critical" strokeWidth={1.75} aria-hidden />
      <p className="font-medium text-ink">Couldn’t load this</p>
      <p className="mt-1 max-w-narrow text-sm text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/** Inline message banner (form errors, notices). Neutral surface; only the icon carries status colour. */
export function Notice({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'success' | 'warning'; children: ReactNode }) {
  const icon = {
    danger: 'text-critical',
    warning: 'text-critical',
    info: 'text-faint',
    success: 'text-healthy',
  }[tone]
  const Icon = tone === 'danger' || tone === 'warning' ? AlertCircle : Info
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="flex items-start gap-3 rounded-sm border border-line bg-surface-alt px-4 py-3 text-sm text-ink"
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${icon}`} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
