import { ButtonLink } from '../components/ui/Button'

export default function NotFound({ message = 'The page you’re looking for doesn’t exist.' }: { message?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-muted">Not found</p>
      <h1 className="mt-2">Nothing here</h1>
      <p className="mt-2 max-w-md text-muted">{message}</p>
      <ButtonLink to="/app" className="mt-6">
        Go to the app
      </ButtonLink>
    </div>
  )
}
