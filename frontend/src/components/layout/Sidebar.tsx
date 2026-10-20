import { Plus } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { useWorkspace } from '../../context/workspace'
import { NAV } from '../../lib/nav'
import { Logo } from './Logo'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useAuth()
  const { workspace, path } = useWorkspace()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to={path('dashboard')} onClick={onNavigate} aria-label="Farm Activity home">
          <Logo />
        </Link>
      </div>

      <div className="px-4 pb-4">
        <label htmlFor="workspace-switcher" className="mb-1.5 block text-xs font-medium text-muted">
          Workspace
        </label>
        <select
          id="workspace-switcher"
          value={workspace.id}
          onChange={(e) => {
            onNavigate?.()
            navigate(`/w/${e.target.value}/dashboard`)
          }}
          className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm"
        >
          {me?.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <Link
          to="/onboarding"
          onClick={onNavigate}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md text-sm text-muted hover:text-primary"
        >
          <Plus className="size-4" aria-hidden />
          New workspace
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto border-t border-line px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
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
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line px-5 py-3 text-xs text-muted">
        Signed in as <span className="font-medium text-ink">{me?.user.name}</span>
        <br />
        Role: {workspace.role === 'admin' ? 'Admin' : 'Member'}
      </div>
    </div>
  )
}
