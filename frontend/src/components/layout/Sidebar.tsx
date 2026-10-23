import { ChevronsUpDown, Plus } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { alertApi } from '../../api/endpoints'
import { useAuth } from '../../context/auth'
import { useWorkspace } from '../../context/workspace'
import { useAsync, useInterval } from '../../hooks/useAsync'
import { NAV_GROUPS } from '../../lib/nav'
import { Logo } from './Logo'

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth()
  const { workspace, path } = useWorkspace()
  const navigate = useNavigate()
  const openAlerts = useAsync(() => alertApi.list(workspace.id, 'open'), [workspace.id])
  useInterval(openAlerts.reload, 60_000)
  const alertCount = openAlerts.data?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to={path('dashboard')} onClick={onNavigate} aria-label="Farm Activity home">
          <Logo />
        </Link>
      </div>

      <div className="px-3 pb-3">
        <label htmlFor="workspace-switcher" className="sr-only">
          Workspace
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-primary text-xs font-semibold text-white">
            {initials(workspace.name)}
          </span>
          <select
            id="workspace-switcher"
            value={workspace.id}
            onChange={(e) => {
              onNavigate?.()
              navigate(`/w/${e.target.value}/dashboard`)
            }}
            className="h-12 w-full appearance-none truncate rounded-lg border border-line bg-page pr-9 pl-12 text-sm font-medium hover:border-line-strong"
          >
            {me?.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={path(to)}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-neutral-soft hover:text-ink'
                      }`
                    }
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    <span className="flex-1">{label}</span>
                    {to === 'alerts' && alertCount > 0 && (
                      <span className="rounded-full bg-danger px-1.5 py-px text-[11px] font-semibold text-white tabular-nums">
                        {alertCount}
                        <span className="sr-only"> open alerts</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link
          to="/onboarding"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-neutral-soft hover:text-ink"
        >
          <Plus className="size-[18px]" aria-hidden />
          New workspace
        </Link>
      </nav>

      <Link
        to={path('profile')}
        onClick={onNavigate}
        className="m-3 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-soft"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden>
          {initials(me?.user.name ?? '?')}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{me?.user.name}</span>
          <span className="block truncate text-xs text-muted">{workspace.role === 'admin' ? 'Admin' : 'Member'}</span>
        </span>
      </Link>
    </div>
  )
}
