import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { useWorkspace } from '../../context/workspace'

export function UserMenu() {
  const { me, logout } = useAuth()
  const { path } = useWorkspace()
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-soft"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" aria-hidden>
          {initials}
        </span>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{me?.user.name}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-line bg-surface py-1 shadow-md">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium">{me?.user.name}</p>
            <p className="truncate text-xs text-muted">{me?.user.email}</p>
          </div>
          <Link role="menuitem" to={path('profile')} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-page">
            <UserRound className="size-4 text-muted" aria-hidden />
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-page"
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
