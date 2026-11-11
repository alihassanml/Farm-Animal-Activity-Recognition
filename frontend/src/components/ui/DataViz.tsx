import type { Behaviour } from '../../api/types'
import { BEHAVIOUR_COLOR, BEHAVIOUR_STROKE } from '../../lib/behaviour'

type Scale = 'peach' | 'green'

const SCALE: Record<Scale, { line: string; fill: string }> = {
  peach: { line: 'var(--color-peach-600)', fill: 'var(--color-peach-100)' },
  green: { line: 'var(--color-green-600)', fill: 'var(--color-green-100)' },
}

/** Tiny line + flat area chart. Deep tone for the line, light tone for the fill. */
export function Sparkline({
  values,
  scale = 'peach',
  height = 32,
  className = '',
  label,
}: {
  values: number[]
  scale?: Scale
  height?: number
  className?: string
  label?: string
}) {
  if (values.length < 2) return null
  const w = 100
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - (v / max) * (height - 4)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${w},${height} L0,${height} Z`
  const c = SCALE[scale]
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={area} fill={c.fill} />
      <path d={line} fill="none" stroke={c.line} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** Horizontal share bar in a behaviour's colour (fill + deep-tone outline so light tones stay visible). */
export function ShareBar({ behaviour, percent }: { behaviour: Behaviour; percent: number }) {
  return (
    <span className="block h-2 flex-1 bg-surface-alt">
      <span
        className="block h-full"
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          backgroundColor: BEHAVIOUR_COLOR[behaviour],
          boxShadow: percent > 0 ? `inset 0 0 0 1px ${BEHAVIOUR_STROKE[behaviour]}` : undefined,
        }}
      />
    </span>
  )
}

/** Stacked composition bar: one segment per behaviour, separated by 2px white gaps. */
export function CompositionBar({ parts, label, className = '' }: { parts: { b: Behaviour; n: number }[]; label: string; className?: string }) {
  const total = parts.reduce((s, p) => s + p.n, 0)
  if (total === 0) return null
  return (
    <div className={`flex h-2 gap-0.5 ${className}`} role="img" aria-label={label}>
      {parts
        .filter((p) => p.n > 0)
        .map((p) => (
          <div
            key={p.b}
            style={{
              width: `${(p.n / total) * 100}%`,
              backgroundColor: BEHAVIOUR_COLOR[p.b],
              boxShadow: `inset 0 0 0 1px ${BEHAVIOUR_STROKE[p.b]}`,
            }}
          />
        ))}
    </div>
  )
}
