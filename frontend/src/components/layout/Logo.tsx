import { BRAND } from '../../lib/brand'

/** Plain text wordmark. No icon mark. */
export function Logo({ className = '' }: { className?: string }) {
  return <span className={`inline-flex items-center text-base font-semibold tracking-tight text-ink ${className}`}>{BRAND}</span>
}
