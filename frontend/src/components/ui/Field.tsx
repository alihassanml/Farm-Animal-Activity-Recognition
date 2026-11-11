import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export const control =
  'w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint ' +
  'transition-colors duration-150 hover:border-faint focus:border-ink focus:outline-none focus-visible:outline-none ' +
  'disabled:bg-surface-alt disabled:text-muted aria-[invalid=true]:border-critical'

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
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-muted">
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
        className={`${control} h-11 ${className}`}
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
        className={`${control} h-11 pr-8 ${className}`}
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
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:opacity-50 ${
        checked ? 'border-ink bg-ink' : 'border-line-strong bg-hover'
      }`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow-xs transition-transform duration-150 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}
