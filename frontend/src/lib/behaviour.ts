import type { Behaviour, RuleType } from '../api/types'

export const BEHAVIOURS: Behaviour[] = ['standing', 'lying', 'foraging']

export const BEHAVIOUR_LABEL: Record<Behaviour, string> = {
  standing: 'Standing',
  lying: 'Lying',
  foraging: 'Foraging',
}

/**
 * Labels older models (4- and 5-class) wrote to the database. They are no longer detected; old rows
 * are left out of charts and shown with this label in lists.
 */
export const LEGACY_BEHAVIOUR_LABEL: Record<string, string> = {
  drinking: 'Drinking (old data)',
  rumination: 'Rumination (old data)',
}

/** Label for any stored behaviour, including old ones. */
export function behaviourLabel(behaviour: string): string {
  return BEHAVIOUR_LABEL[behaviour as Behaviour] ?? LEGACY_BEHAVIOUR_LABEL[behaviour] ?? behaviour
}

/**
 * Data colours per behaviour, as token references (tokens.css), so SVG charts,
 * swatches and bars all read from the same source.
 *   peach = activity (standing, feeding), neutral grey = resting / lying.
 * FILL is for areas and swatches; STROKE is the deep tone for thin lines and
 * small marks that must stay visible on white.
 */
export const BEHAVIOUR_COLOR: Record<Behaviour, string> = {
  standing: 'var(--color-peach-600)',
  lying: 'var(--color-series-neutral)',
  foraging: 'var(--color-peach-300)',
}

export const BEHAVIOUR_STROKE: Record<Behaviour, string> = {
  standing: 'var(--color-peach-600)',
  lying: 'var(--color-faint)',
  foraging: 'var(--color-peach-600)',
}

export const RULE_LABEL: Record<RuleType, string> = {
  lying_ratio: 'Too much lying',
  no_foraging: 'No foraging',
}

export function describeRule(type: RuleType, threshold: number | null, windowMinutes: number): string {
  const window = formatWindow(windowMinutes)
  if (type === 'lying_ratio') return `Lying above ${threshold ?? 70}% over ${window}`
  return `No foraging seen for ${window}`
}

export function formatWindow(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return h === 1 ? '1 hour' : `${h} hours`
  }
  return `${minutes} minutes`
}
