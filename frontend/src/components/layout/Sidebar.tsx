import { ChevronsUpDown, Plus } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { alertApi } from '../../api/endpoints'
import { useAuth } from '../../context/auth'
import { useWorkspace } from '../../context/workspace'
import { useAsync, useInterval } from '../../hooks/useAsync'
import { NAV_GROUPS } from '../../lib/nav'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'

const ITEM =
  'flex h-9 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-150'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth()
  const { workspace, path } = useWorkspace()
  const navigate = useNavigate()
  const openAlerts = useAsync(() => alertApi.list(workspace.id, 'open'), [workspace.id])
  useInterval(openAlerts.reload, 60_000)
  const alertCount = openAlerts.data?.length ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Link to={path('dashboard')} onClick={onNavigate} aria-label="Dashboard">
          <Logo />
        </Link>
      </div>

      <div className="px-3 pb-4">
        <label htmlFor="workspace-switcher" className="sr-only">
          Workspace
        </label>
        <div className="relative">
          <select
            id="workspace-switcher"
            value={workspace.id}
            onChange={(e) => {
              onNavigate?.()
              navigate(`/w/${e.target.value}/dashboard`)
            }}
            className="h-9 w-full appearance-none truncate rounded-sm border border-line bg-white pr-8 pl-3 text-sm font-medium text-ink transition-colors duration-150 hover:border-line-strong"
          >
            {me?.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="px-3 pb-2 text-xs text-muted">{group.label}</p>
            <ul className="flex flex-col gap-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={path(to)}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `${ITEM} ${isActive ? 'bg-hover font-medium text-ink' : 'text-secondary hover:bg-hover hover:text-ink'}`
                    }
                  >
                    <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {to === 'alerts' && alertCount > 0 && (
                      <span className="numeric text-xs text-critical">
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
        <Link to="/onboarding" onClick={onNavigate} className={`${ITEM} text-secondary hover:bg-hover hover:text-ink`}>
          <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          New workspace
        </Link>
      </nav>

      <div className="border-t border-line p-3">
        <UserMenu onNavigate={onNavigate} />
      </div>
    </div>
  )
}
