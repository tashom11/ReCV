import type { ReactNode } from 'react'

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
