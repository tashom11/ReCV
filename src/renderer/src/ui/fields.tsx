import { type ReactNode, useId } from 'react'
import { Icon } from './icons'

const FIELD_BASE =
  'w-full rounded-champ border bg-surface px-3.5 text-corps text-encre placeholder:text-indicatif transition duration-(--duree-rapide) hover:border-encre-douce'

const border = (error?: string) => (error ? 'border-2 border-erreur' : 'border-trait-fort')

function FieldFooter({ hintId, hint, error }: { hintId: string; hint?: string; error?: string }) {
  if (error)
    return (
      <span id={hintId} className="flex items-start gap-1.5 text-petit font-bold text-erreur">
        <Icon name="info" size={16} className="mt-0.5" />
        {error}
      </span>
    )
  return hint ? (
    <span id={hintId} className="block text-petit text-aide">
      {hint}
    </span>
  ) : null
}

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  toLines = 3,
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
  toLines?: number
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
            className={`${FIELD_BASE} ${border(error)} py-2.5${action ? ' pb-16' : ''}`}
            rows={toLines}
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
          className={`${FIELD_BASE} ${border(error)} ${large ? 'min-h-14 text-intro' : 'min-h-12'}`}
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

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-libelle font-bold text-encre">
        {label}
      </label>
      <select
        id={id}
        className={`${FIELD_BASE} min-h-12 border-trait-fort`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** 22 px checkbox; the whole row is clickable (the label wraps the box). */
export function Checkbox({
  label,
  check,
  onChange,
  hint,
  disabled = false,
}: {
  label: ReactNode
  check: boolean
  onChange: (check: boolean) => void
  hint?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-champ py-2.5">
      <input
        type="checkbox"
        className="mt-px size-[22px] shrink-0"
        checked={check}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-corps text-encre">{label}</span>
        {hint && <span className="block text-petit text-aide">{hint}</span>}
      </span>
    </label>
  )
}
