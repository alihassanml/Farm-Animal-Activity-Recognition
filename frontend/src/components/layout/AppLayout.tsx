import { Menu, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { WorkspaceContext, type WorkspaceValue } from '../../context/workspace'
import { setLastWorkspace } from '../../lib/storage'
import NotFound from '../../pages/NotFound'
import { NAV } from '../../lib/nav'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

const EXTRA_TITLES: Record<string, string> = { profile: 'Profile' }

export function AppLayout() {
  const { workspaceId } = useParams()
  const { me } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const workspace = me?.workspaces.find((w) => w.id === Number(workspaceId))

  const value = useMemo<WorkspaceValue | null>(
    () =>
      workspace
        ? { workspace, isAdmin: workspace.role === 'admin', path: (page: string) => `/w/${workspace.id}/${page}` }
        : null,
    [workspace],
  )

  useEffect(() => {
    if (workspace) setLastWorkspace(workspace.id)
  }, [workspace])

  if (!value) return <NotFound message="This workspace doesn’t exist or you’re not a member of it." />

  const page = location.pathname.split('/')[3] ?? 'dashboard'
  const title = NAV.find((n) => n.to === page)?.label ?? EXTRA_TITLES[page] ?? ''

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute top-4 right-3 rounded-md p-1.5 text-muted hover:bg-neutral-soft"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <div className="lg:pl-64">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-1.5 text-muted hover:bg-neutral-soft lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
            <UserMenu />
          </header>
          <main className="w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  )
}
