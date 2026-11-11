import { AlertCircle } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'

/**
 * Catches a crash while rendering (a bug, or a page chunk that failed to download after an update)
 * and shows a recovery screen instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunkFailed = /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message)
    return (
      <main role="alert" className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <AlertCircle className="mb-4 size-6 text-critical" strokeWidth={1.75} aria-hidden />
        <h1 className="text-h3">Something went wrong on this page</h1>
        <p className="mt-2 max-w-narrow text-secondary">
          {chunkFailed
            ? 'Part of the app could not be loaded. The app may have been updated, or the server is not reachable.'
            : 'Reloading usually fixes it. If it keeps happening, note what you did and check the browser console.'}
        </p>
        <p className="numeric mt-4 max-w-narrow text-xs break-words text-muted">{error.message}</p>
        <div className="mt-8 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <Button variant="secondary" onClick={() => window.location.assign('/app')}>
            Go to dashboard
          </Button>
        </div>
      </main>
    )
  }
}
