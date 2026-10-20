import type { ReactNode } from 'react'
import type { Behaviour } from '../../api/types'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL } from '../../lib/behaviour'

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function BehaviourBadge({ behaviour }: { behaviour: Behaviour | string }) {
  const b = behaviour as Behaviour
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: BEHAVIOUR_COLOR[b] ?? '#5f6762' }} aria-hidden />
      {BEHAVIOUR_LABEL[b] ?? behaviour}
    </span>
  )
}
