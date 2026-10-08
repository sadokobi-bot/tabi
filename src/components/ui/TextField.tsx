import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

const CONTROL =
  'w-full min-w-0 rounded-control border border-line bg-card/70 px-4 text-base text-fg placeholder:text-muted/70 outline-none transition ' +
  'focus:border-accent/60 focus:ring-4 focus:ring-accent/12 aria-invalid:border-red-500/60'

interface FieldShellProps {
  id: string
  label: string
  hint?: string
  error?: string | null
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}

function FieldShell({ id, label, hint, error, leading, trailing, children }: FieldShellProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        {children}
        {leading && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">
            {leading}
          </div>
        )}
        {trailing && <div className="absolute inset-y-0 left-2 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${id}-note`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-note`} className="mt-1.5 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Screen readers announce the hint or error together with the field. */
const noteId = (id: string, hint?: string, error?: string | null) => (error || hint ? `${id}-note` : undefined)

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
  /** Icon at the start (right) of the field. */
  leading?: ReactNode
  trailing?: ReactNode
}

export function TextField({ label, hint, error, leading, trailing, className, id, ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} leading={leading} trailing={trailing}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId(inputId, hint, error)}
        className={clsx(CONTROL, 'h-12', leading && 'pr-11', trailing && 'pl-12', className)}
        {...rest}
      />
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string | null
}

export function TextAreaField({ label, hint, error, className, id, ...rest }: TextAreaFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId(inputId, hint, error)}
        className={clsx(CONTROL, 'min-h-24 resize-y py-3', className)}
        {...rest}
      />
    </FieldShell>
  )
}
