import { BRAND } from '../../lib/brand'

/** Viewfinder mark (four corner brackets) + wordmark. Ink only. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-base font-semibold tracking-tight text-ink ${className}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path d="M6.5 9.5v-3h3M14.5 6.5h3v3M17.5 14.5v3h-3M9.5 17.5h-3v-3" fill="none" stroke="var(--color-white)" strokeWidth="1.6" />
        <rect x="10" y="10" width="4" height="4" fill="var(--color-peach-100)" />
      </svg>
      {BRAND}
    </span>
  )
}
