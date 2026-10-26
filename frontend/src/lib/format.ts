const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeSeconds = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const hourOnly = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDate = (iso: string) => dateOnly.format(new Date(iso))
export const formatTime = (iso: string) => timeSeconds.format(new Date(iso))
export const formatHour = (iso: string) => hourOnly.format(new Date(iso))

export function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return formatDate(iso)
}

/** Position in a video, e.g. 75 s -> "1:15" (or "1:02:05" past an hour). */
export function formatOffset(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const mmss = `${Math.floor((s % 3600) / 60)}:${String(s % 60).padStart(2, '0')}`
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mmss.padStart(5, '0')}` : mmss
}

/** Whole seconds since an ISO time (never negative). */
export function secondsSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
}

/** 45 -> "45 s", 300 -> "5 min", 4500 -> "1 h 15 min" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

export const formatPercent = (v: number) => `${Math.round(v * 100)}%`

export const formatNumber = (v: number) => new Intl.NumberFormat().format(v)

/** Value for <input type="datetime-local"> -> ISO string in UTC (or undefined). */
export function localInputToIso(v: string): string | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
