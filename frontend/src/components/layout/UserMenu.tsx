import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { useWorkspace } from '../../context/workspace'

/** Account button at the foot of the sidebar; the menu opens upwards. */
export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { me, logout } = useAuth()
  const { path, workspace } = useWorkspace()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = (me?.user.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const item = 'flex h-9 w-full items-center gap-2 rounded-sm px-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-hover'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-sm p-2 text-left transition-colors duration-150 hover:bg-hover"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-alt text-xs font-medium text-ink" aria-hidden>
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{me?.user.name}</span>
          <span className="block truncate text-xs text-muted">{workspace.role === 'admin' ? 'Admin' : 'Member'}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-faint" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full left-0 z-30 mb-2 rounded-md border border-line bg-white p-1 shadow-overlay">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-xs text-muted">{me?.user.email}</p>
          </div>
          <div className="pt-1">
            <Link
              role="menuitem"
              to={path('profile')}
              onClick={() => {
                setOpen(false)
                onNavigate?.()
              }}
              className={item}
            >
              <UserRound className="size-4 text-faint" strokeWidth={1.75} aria-hidden />
              Profile
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={async () => {
                setOpen(false)
                await logout()
                navigate('/login')
              }}
              className={item}
            >
              <LogOut className="size-4 text-faint" strokeWidth={1.75} aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
