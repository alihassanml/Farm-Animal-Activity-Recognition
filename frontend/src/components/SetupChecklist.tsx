import { ArrowRight, Check, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../api/types'
import { useWorkspace } from '../context/workspace'
import { getFlag, setFlag } from '../lib/storage'
import { Card } from './ui/Card'

/** "Get your workspace ready" steps, shown on Workspace settings until done or hidden. */
export function SetupChecklist({ data }: { data: DashboardSummary }) {
  const { workspace, path, isAdmin } = useWorkspace()
  const key = `setupDismissed.${workspace.id}`
  const [dismissed, setDismissed] = useState(() => getFlag(key))

  const steps = [
    { done: data.analyses_total > 0, title: 'Analyze your first image or video', text: 'See how the model labels each cow.', to: path('analyze'), cta: 'Analyze' },
    { done: data.cameras_total > 0, title: 'Add a camera', text: 'Monitor the barn around the clock.', to: isAdmin ? path('cameras') : null, cta: 'Add camera' },
    { done: data.members_total > 1, title: 'Invite your team', text: 'Share alerts with farm staff and your vet.', to: isAdmin ? '#invite' : null, cta: 'Invite' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (dismissed || doneCount === steps.length) return null

  const ctaClass = 'mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline'

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div>
          <h3 className="text-base font-semibold">Get your workspace ready</h3>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFlag(key)
            setDismissed(true)
          }}
          className="rounded-md p-1 text-muted hover:bg-neutral-soft hover:text-ink"
          aria-label="Hide setup steps"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-soft">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-px p-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-md p-3">
            <span
              className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${s.done ? 'bg-primary text-white' : 'border border-line-strong text-transparent'}`}
              aria-hidden
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className={`font-medium ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</p>
              <p className="text-sm text-muted">{s.text}</p>
              {!s.done &&
                s.to &&
                (s.to.startsWith('#') ? (
                  <a href={s.to} className={ctaClass}>
                    {s.cta} <ArrowRight className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  <Link to={s.to} className={ctaClass}>
                    {s.cta} <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                ))}
              <span className="sr-only">{s.done ? '(done)' : '(not done)'}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
