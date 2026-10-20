import type { Behaviour, RuleType } from '../api/types'

export const BEHAVIOURS: Behaviour[] = ['standing', 'lying', 'foraging', 'drinking', 'rumination']

export const BEHAVIOUR_LABEL: Record<Behaviour, string> = {
  standing: 'Standing',
  lying: 'Lying',
  foraging: 'Foraging',
  drinking: 'Drinking',
  rumination: 'Rumination',
}

// Same values as tokens.css (charts need raw colours)
export const BEHAVIOUR_COLOR: Record<Behaviour, string> = {
  standing: '#2e6fb0',
  lying: '#7a5aa6',
  foraging: '#2e7d32',
  drinking: '#0b7676',
  rumination: '#9a5b00',
}

export const RULE_LABEL: Record<RuleType, string> = {
  lying_ratio: 'Too much lying',
  no_foraging: 'No foraging',
  no_drinking: 'No drinking',
}

export function describeRule(type: RuleType, threshold: number | null, windowMinutes: number): string {
  const window = formatWindow(windowMinutes)
  if (type === 'lying_ratio') return `Lying above ${threshold ?? 70}% over ${window}`
  return `No ${type === 'no_foraging' ? 'foraging' : 'drinking'} seen for ${window}`
}

export function formatWindow(minutes: number): string {
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return h === 1 ? '1 hour' : `${h} hours`
  }
  return `${minutes} minutes`
}
