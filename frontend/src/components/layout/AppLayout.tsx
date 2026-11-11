import { Menu, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../../context/auth'
import { WorkspaceContext, type WorkspaceValue } from '../../context/workspace'
import { setLastWorkspace } from '../../lib/storage'
import NotFound from '../../pages/NotFound'
import { Logo } from './Logo'
import { Sidebar } from './Sidebar'

/**
 * The one shell for every logged-in page: fixed white sidebar on desktop (drawer on mobile)
 * and a content column with the same padding (16px mobile, 32px desktop) and the same
 * 1200px max width on every page. Pages render their own PageHeader.
 */
export function AppLayout() {
  const { workspaceId } = useParams()
  const { me } = useAuth()
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

  return (
    <WorkspaceContext.Provider value={value}>
      <div className="min-h-dvh bg-white">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-line bg-white lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-white">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="absolute top-4 right-3 rounded-sm p-2 text-muted transition-colors duration-150 hover:bg-hover hover:text-ink"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <div className="lg:pl-60">
          {/* Mobile top bar only; on desktop the sidebar carries brand and account. */}
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-2 rounded-sm p-2 text-secondary transition-colors duration-150 hover:bg-hover hover:text-ink"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <Link to={value.path('dashboard')} aria-label="Dashboard">
              <Logo />
            </Link>
          </header>
          <main className="px-4 py-8 lg:px-8 lg:py-12">
            <div className="mx-auto w-full max-w-site min-w-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  )
}
