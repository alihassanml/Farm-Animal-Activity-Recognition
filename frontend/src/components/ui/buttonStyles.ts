export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap ' +
  'transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-hover',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-alt',
  danger: 'border border-line bg-surface text-critical hover:border-line-strong hover:bg-surface-alt',
  ghost: 'text-secondary hover:bg-hover hover:text-ink',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3',
  md: 'h-11 px-6',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`
}
