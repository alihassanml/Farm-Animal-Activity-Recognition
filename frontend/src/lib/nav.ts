import { Bell, LayoutDashboard, ListChecks, PawPrint, ScanSearch, Settings, Video, type LucideIcon } from 'lucide-react'

export const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: 'analyze', label: 'Analyze', icon: ScanSearch },
  { to: 'cameras', label: 'Cameras', icon: Video },
  { to: 'activity', label: 'Activity logs', icon: ListChecks },
  { to: 'alerts', label: 'Alerts', icon: Bell },
  { to: 'animals', label: 'Animals', icon: PawPrint },
  { to: 'settings', label: 'Workspace settings', icon: Settings },
]

/** Only allow same-site relative redirects (no open redirect via ?next=). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'
}
