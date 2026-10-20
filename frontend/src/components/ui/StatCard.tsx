import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        <Icon className="size-[18px] text-muted" aria-hidden />
      </div>
      <p className="mt-2 text-[28px] leading-none font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  )
}
