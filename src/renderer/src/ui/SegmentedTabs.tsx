import { Icon, type IconName } from './icons'

/** Id of a tab, for the `aria-labelledby` of the panel it controls. */
export const tabId = (panelId: string, id: string) => `${panelId}-tab-${id}`

/**
 * Choice between input modes: segmented tabs (WAI-ARIA tabs pattern). Arrows move between tabs, Home/End go to the
 * first/last one. While `disabled`, the tabs stay focusable (`aria-disabled`): the focus is never lost.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  panelId,
  label,
  disabled = false,
}: {
  tabs: { id: T; label: string; icon?: IconName }[]
  value: T
  onChange: (id: T) => void
  /** Id of the controlled panel (`role="tabpanel"`). */
  panelId: string
  label: string
  disabled?: boolean
}) {
  const select = (index: number) => {
    const next = tabs[(index + tabs.length) % tabs.length]
    if (!next || disabled) return
    onChange(next.id)
    document.getElementById(tabId(panelId, next.id))?.focus()
  }
  const current = tabs.findIndex((t) => t.id === value)
  const keys: Record<string, () => void> = {
    ArrowRight: () => select(current + 1),
    ArrowLeft: () => select(current - 1),
    Home: () => select(0),
    End: () => select(tabs.length - 1),
  }
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-carte bg-creux p-1"
    >
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            id={tabId(panelId, tab.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            aria-disabled={disabled || undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => !disabled && onChange(tab.id)}
            onKeyDown={(e) => {
              const action = keys[e.key]
              if (!action) return
              e.preventDefault()
              action()
            }}
            className={`inline-flex min-h-12 items-center gap-2.5 rounded-bouton px-5 text-intro font-bold transition duration-(--duree-rapide) ${
              active ? 'bg-surface text-encre shadow-carte' : 'text-encre-douce hover:text-encre'
            } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {tab.icon && <Icon name={tab.icon} />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
