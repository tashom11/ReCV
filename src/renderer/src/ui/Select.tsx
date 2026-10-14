import { useId } from 'react'
import { FIELD_BASE } from './fieldParts'

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
