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

/** Behaviour label in its chart/box colour on an 8% tint of it (text contrast stays above 4.5:1). */
export function BehaviourBadge({ behaviour }: { behaviour: Behaviour | string }) {
  const b = behaviour as Behaviour
  const color = BEHAVIOUR_COLOR[b] ?? '#5f6762'
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-sm font-medium whitespace-nowrap"
      style={{ color, backgroundColor: `${color}14` }}
    >
      {BEHAVIOUR_LABEL[b] ?? behaviour}
    </span>
  )
}
