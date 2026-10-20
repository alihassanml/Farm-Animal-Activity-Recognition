import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const control =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-muted ' +
  'focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30 ' +
  'disabled:bg-page disabled:text-muted aria-[invalid=true]:border-danger'

interface WrapProps {
  label: string
  hint?: string
  error?: string
  id: string
  children: ReactNode
  className?: string
}

function Wrap({ label, hint, error, id, children, className = '' }: WrapProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type Common = { label: string; hint?: string; error?: string; wrapperClassName?: string }

export function Input({ label, hint, error, wrapperClassName, className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Wrap label={label} hint={hint} error={error} id={id} className={wrapperClassName}>
      <input
        id={id}
        className={`${control} h-10 ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
    </Wrap>
  )
}

export function Select({ label, hint, error, wrapperClassName, className = '', children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Wrap label={label} hint={hint} error={error} id={id} className={wrapperClassName}>
      <select
        id={id}
        className={`${control} h-10 pr-8 ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  )
}

export function Textarea({ label, hint, error, wrapperClassName, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Wrap label={label} hint={hint} error={error} id={id} className={wrapperClassName}>
      <textarea
        id={id}
        className={`${control} min-h-24 py-2 ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
    </Wrap>
  )
}

export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
        checked ? 'border-primary bg-primary' : 'border-line-strong bg-neutral-soft'
      }`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}
