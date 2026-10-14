import { type ReactNode, useId } from 'react'
import { FIELD_BASE, FieldFooter, fieldBorder } from './fieldParts'

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  type = 'text',
  placeholder,
  action,
  hint,
  error,
  large = false,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  type?: 'text' | 'password' | 'url' | 'email' | 'tel'
  /** Purpose of a personal data field (WCAG 1.3.5), e.g. `name`, `email`, `tel`. */
  autoComplete?: string
  placeholder?: string
  /** Button shown at the bottom right, inside the text area (multiline fields). */
  action?: ReactNode
  hint?: string
  error?: string
  /** Main field of the screen (job posting address): taller, larger text. */
  large?: boolean
}) {
  const id = useId()
  const hintId = `${id}-aide`
  const describedBy = hint || error ? hintId : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-libelle font-bold text-encre">
        {label}
      </label>
      {multiline ? (
        <div className="relative">
          <textarea
            id={id}
            className={`${FIELD_BASE} ${fieldBorder(error)} py-2.5${action ? ' pb-16' : ''}`}
            rows={rows}
            value={value}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          />
          {action && <div className="absolute right-2.5 bottom-3.5">{action}</div>}
        </div>
      ) : (
        <input
          id={id}
          className={`${FIELD_BASE} ${fieldBorder(error)} ${large ? 'min-h-14 text-intro' : 'min-h-12'}`}
          type={type}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <FieldFooter hintId={hintId} hint={hint} error={error} />
    </div>
  )
}
