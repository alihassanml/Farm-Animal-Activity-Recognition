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

  const ctaClass = 'link mt-2 inline-flex items-center gap-1 text-sm'

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 className="text-base font-semibold">Get your workspace ready</h2>
          <p className="mt-1 text-sm text-secondary">
            <span className="numeric">
              {doneCount} of {steps.length}
            </span>{' '}
            done
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFlag(key)
            setDismissed(true)
          }}
          className="rounded-sm p-1 text-muted transition-colors duration-150 hover:bg-hover hover:text-ink"
          aria-label="Hide setup steps"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mx-6 mt-4 h-1 bg-surface-alt">
        <div className="h-full bg-green-600 transition-[width] duration-500 ease-out" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-6 p-6 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3">
            <span
              className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-ink text-white' : 'border border-line-strong text-transparent'}`}
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${s.done ? 'text-muted line-through' : 'text-ink'}`}>{s.title}</p>
              <p className="mt-1 text-sm text-secondary">{s.text}</p>
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
