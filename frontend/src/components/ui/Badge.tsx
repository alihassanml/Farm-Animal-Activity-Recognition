import type { ReactNode } from 'react'
import type { Behaviour } from '../../api/types'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOUR_STROKE } from '../../lib/behaviour'

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

/**
 * Status marker beside the label. Text always stays ink, so status never relies on colour alone.
 *   success = healthy green dot, danger = critical dot, warning = critical ring,
 *   primary = ink dot (in progress), neutral = grey dot.
 */
const DOT: Record<Tone, string> = {
  neutral: 'bg-faint',
  primary: 'bg-ink',
  success: 'bg-healthy',
  warning: 'border-2 border-critical',
  danger: 'bg-critical',
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-2 rounded-sm border border-line bg-surface px-2 text-xs font-medium whitespace-nowrap text-ink">
      <StatusDot tone={tone} />
      {children}
    </span>
  )
}

/** Small square in a behaviour's data colour, outlined in the deep tone so light fills stay visible. */
export function Swatch({ behaviour, className = '' }: { behaviour: Behaviour; className?: string }) {
  return (
    <span
      className={`inline-block size-2.5 shrink-0 ${className}`}
      style={{ backgroundColor: BEHAVIOUR_COLOR[behaviour], boxShadow: `inset 0 0 0 1px ${BEHAVIOUR_STROKE[behaviour]}` }}
      aria-hidden
    />
  )
}

/** Behaviour label: data-colour swatch plus the name in ink. */
export function BehaviourBadge({ behaviour }: { behaviour: Behaviour | string }) {
  const b = behaviour as Behaviour
  const known = b in BEHAVIOUR_LABEL
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-ink">
      {known ? <Swatch behaviour={b} /> : <span className="inline-block size-2.5 shrink-0 bg-line" aria-hidden />}
      {BEHAVIOUR_LABEL[b] ?? behaviour}
    </span>
  )
}
