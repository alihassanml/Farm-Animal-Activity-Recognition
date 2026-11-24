import type { ReactNode } from 'react'
import type { Behaviour } from '../../api/types'
import { BEHAVIOUR_COLOR, BEHAVIOUR_LABEL, BEHAVIOUR_STROKE, behaviourLabel } from '../../lib/behaviour'

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

/** Text-only status label. The label itself carries the meaning; tone only sets the text colour. */
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-secondary',
  primary: 'text-ink',
  success: 'text-ink',
  warning: 'text-critical',
  danger: 'text-critical',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-sm border border-line bg-surface px-2 text-xs font-medium whitespace-nowrap ${TONE_TEXT[tone]}`}
    >
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

/** Behaviour label: data-colour swatch plus the name in ink. Old labels (drinking, rumination) get a grey swatch. */
export function BehaviourBadge({ behaviour }: { behaviour: Behaviour | string }) {
  const b = behaviour as Behaviour
  const known = b in BEHAVIOUR_LABEL
  return (
    <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-ink">
      {known ? <Swatch behaviour={b} /> : <span className="inline-block size-2.5 shrink-0 bg-line" aria-hidden />}
      {behaviourLabel(behaviour)}
    </span>
  )
}
