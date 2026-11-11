import { ButtonLink } from '../components/ui/Button'

export default function NotFound({ message = 'The page you’re looking for doesn’t exist.' }: { message?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-start justify-center px-6 py-16 sm:items-center sm:text-center">
      <p className="numeric text-sm text-muted">404</p>
      <h1 className="mt-4 text-h3">Nothing here</h1>
      <p className="mt-2 max-w-narrow text-secondary">{message}</p>
      <ButtonLink to="/app" className="mt-8">
        Go to the app
      </ButtonLink>
    </div>
  )
}
