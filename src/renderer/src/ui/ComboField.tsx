import { useId, useRef, useState } from 'react'
import { texts } from '../i18n'
import { FIELD_BASE, FieldFooter, fieldBorder } from './fieldParts'

/** A suggestion: what goes into the field, and a detail shown next to it (not written in the field). */
export interface Suggestion {
  value: string
  detail?: string
}

/**
 * Text field with a list of suggestions under it (ARIA « combobox » pattern, list without automatic selection). What
 * the user types stays free: a suggestion only saves typing, it is never required.
 */
export function ComboField({
  label,
  value,
  onChange,
  getSuggestions,
  placeholder,
  hint,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  /** Suggestions for what has just been typed (empty list: no popup). May be asynchronous. */
  getSuggestions: (typed: string) => Suggestion[] | Promise<Suggestion[]>
  placeholder?: string
  hint?: string
  /** Purpose of a personal data field (WCAG 1.3.5). */
  autoComplete?: string
}) {
  const id = useId()
  const listId = `${id}-liste`
  const hintId = `${id}-aide`
  const optionId = (index: number) => `${id}-option-${index}`
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Answers can arrive out of order: only the last question counts.
  const lastRequest = useRef(0)

  const ask = async (typed: string) => {
    const request = ++lastRequest.current
    let found: Suggestion[] = []
    try {
      found = await getSuggestions(typed)
    } catch {
      // Suggestions are a convenience: a failure leaves the field as a plain one.
    }
    if (request !== lastRequest.current) return
    setItems(found)
    setActive(-1)
    setOpen(found.length > 0)
  }

  const type = (typed: string) => {
    onChange(typed)
    void ask(typed)
  }

  const choose = (item: Suggestion) => {
    lastRequest.current++
    onChange(item.value)
    setItems([])
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActive((current) => (current + 1) % items.length)
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1))
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      const picked = items[active]
      if (picked) choose(picked)
    } else if (event.key === 'Escape' && open) {
      // Closes the list only, not a dialog around the field.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="block text-libelle font-bold text-encre">
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-describedby={hint ? hintId : undefined}
        className={`${FIELD_BASE} ${fieldBorder()} min-h-12`}
        type="text"
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={(event) => type(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 max-h-72 w-full overflow-auto rounded-champ border border-trait-fort bg-surface py-1 shadow-carte"
        >
          {items.map((item, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard path is the input itself (arrows and Enter)
            <div
              key={`${item.value}|${item.detail ?? ''}`}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              // The input keeps the focus: the field must not close before the click is taken into account.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={`flex cursor-pointer items-baseline px-3.5 py-2.5 text-corps text-encre ${index === active ? 'bg-marque-pale' : 'hover:bg-papier'}`}
            >
              <span>{item.value}</span>
              {item.detail && <span className="ml-3 text-petit text-aide"> {item.detail}</span>}
            </div>
          ))}
        </div>
      )}
      <span role="status" className="sr-only">
        {open ? texts.comboField.available(items.length) : ''}
      </span>
      <FieldFooter hintId={hintId} hint={hint} />
    </div>
  )
}
