import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'

/**
 * Shell for standalone screens (log in, sign up, onboarding, invites, not found):
 * the site header row, then one narrow left-aligned column, vertically centred.
 */
export function PublicShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-line">
        <div className="container-site flex h-16 items-center">
          <Link to="/" aria-label="Home">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="container-site flex flex-1 items-center py-16">
        <div className={`grid w-full items-center gap-16 ${aside ? 'lg:grid-cols-2' : ''}`}>
          <div className="mx-auto w-full max-w-narrow lg:mx-0">{children}</div>
          {aside && <div className="hidden lg:block">{aside}</div>}
        </div>
      </main>
    </div>
  )
}

/** Page title block used inside PublicShell. */
export function ShellTitle({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-h3">{title}</h1>
      {subtitle && <p className="mt-2 text-secondary">{subtitle}</p>}
    </div>
  )
}
