import type { ReactNode } from 'react'
import { formatDuration, useElapsedSeconds } from '../progress'
import { Icon, type IconName, Spinner } from './icons'

export function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-carte border border-trait bg-surface p-6 shadow-carte">
      {title && (
        <header>
          <h2 className="font-titre text-titre-section font-bold text-encre">{title}</h2>
          {subtitle && <p className="text-petit text-aide">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageTitle({
  children,
  subtitle,
  kicker,
}: {
  children: ReactNode
  subtitle?: string
  /** Short mention above the title (« Annonce lue »), preceded by a check mark. */
  kicker?: string
}) {
  return (
    <header className="space-y-2">
      {kicker && (
        <p className="flex items-center gap-2 font-bold text-marque">
          <Icon name="check-circle" />
          {kicker}
        </p>
      )}
      <h1 className="font-titre text-titre-ecran font-bold text-encre">{children}</h1>
      {subtitle && <p className="text-intro text-encre-douce">{subtitle}</p>}
    </header>
  )
}

/**
 * « Working » block for short waits inside a screen: current step, elapsed time and progress bar (determinate if
 * `current`/`total` are known, otherwise indeterminate).
 */
export function Loading({
  title,
  step,
  current,
  total,
  note,
}: {
  title: string
  step?: string
  current?: number
  total?: number
  note?: string
}) {
  const seconds = useElapsedSeconds(true)
  const determinate = current !== undefined && total !== undefined && total > 0
  return (
    <div role="status" aria-live="polite" className="space-y-3 rounded-carte border border-trait bg-surface p-5">
      <div className="flex items-center gap-3 text-encre">
        <span className="text-marque">
          <Spinner size={22} />
        </span>
        <div className="flex-1">
          <p className="font-bold">{title}</p>
          {step && (
            <p className="text-petit text-aide">
              {step}
              {determinate ? ` (${current}/${total})` : ''}
            </p>
          )}
        </div>
        <span className="text-petit tabular-nums text-aide" aria-hidden="true">
          {formatDuration(seconds)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-creux">
        {determinate ? (
          <div
            className="h-full rounded-full bg-marque transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(((current ?? 0) / (total ?? 1)) * 100))}%` }}
          />
        ) : (
          <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
        )}
      </div>
      {note && <p className="text-petit text-aide">{note}</p>}
    </div>
  )
}

/** Rounded label: always a word (and a check mark for « present »), never colour alone. */
export function Pill({
  children,
  variant = 'requested',
}: {
  children: ReactNode
  variant?: 'requested' | 'present' | 'recommended' | 'on-dark'
}) {
  const styles = {
    requested: 'border border-accent bg-accent-pale px-4 py-1.5 text-corps text-encre',
    present: 'border border-marque/40 bg-marque-pale px-4 py-1.5 text-corps text-encre',
    recommended: 'bg-marque px-2.5 py-0.5 text-petit font-bold text-white',
    'on-dark': 'bg-white/12 px-3 py-1 text-petit text-white',
  }[variant]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${styles}`}>
      {variant === 'present' && <Icon name="check" size={16} className="text-marque" />}
      {children}
    </span>
  )
}

/** Section of a long form, closed by default: native `<details>` (keyboard and screen readers for free). */
export function Collapsible({
  title,
  count,
  summaryLine,
  open = false,
  children,
}: {
  title: string
  /** Number or mention in brackets after the title (« (3) », « (facultative) »). */
  count?: number | string
  /** One-line summary under the title. */
  summaryLine?: string
  open?: boolean
  children: ReactNode
}) {
  return (
    <details open={open} className="group rounded-carte border border-trait bg-surface shadow-carte">
      <summary className="flex min-h-16 items-center gap-4 rounded-carte px-5 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-titre text-intro font-bold text-encre">
            {title}
            {count !== undefined && <span className="font-sans font-normal text-encre-douce"> ({count})</span>}
          </span>
          {summaryLine && <span className="block truncate text-petit text-aide">{summaryLine}</span>}
        </span>
        <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-5 pt-1 pb-5">{children}</div>
    </details>
  )
}

/** Choice between two input modes: segmented tabs, left/right arrows to switch from one to the other. */
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
  const move = (step: number) => {
    const index = tabs.findIndex((o) => o.id === value)
    const next = tabs[(index + step + tabs.length) % tabs.length]
    if (!next) return
    onChange(next.id)
    document.getElementById(`${panelId}-onglet-${next.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-carte bg-creux p-1">
      {tabs.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            id={`${panelId}-onglet-${o.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1)
              if (e.key === 'ArrowLeft') move(-1)
            }}
            className={`inline-flex min-h-12 items-center gap-2.5 rounded-bouton px-5 text-intro font-bold transition duration-(--duree-rapide) ${
              active ? 'bg-surface text-encre shadow-carte' : 'text-encre-douce hover:text-encre'
            }`}
          >
            {o.icon && <Icon name={o.icon} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Screen without content: says what will appear here and how to get there. */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panneau border-2 border-dashed border-trait bg-surface px-6 py-12 text-center">
      <div className="mb-2 w-[70px] space-y-2 rounded-champ border-2 border-trait bg-papier p-2.5" aria-hidden="true">
        <div className="h-1.5 w-3/5 rounded-full bg-trait" />
        <div className="h-1 rounded-full bg-trait" />
        <div className="h-1 w-4/5 rounded-full bg-trait" />
        <div className="h-1 w-3/5 rounded-full bg-trait" />
        <div className="h-6" />
      </div>
      {/* Always the whole content of a screen: its title is the screen title. */}
      <h1 className="font-titre text-titre-section font-bold text-encre">{title}</h1>
      <p className="max-w-md text-corps text-encre-douce">{text}</p>
      {action && <div className="pt-3">{action}</div>}
    </div>
  )
}

/** Bar stuck to the bottom of the screen: the step action always stays visible. */
export function ActionBar({
  left,
  children,
  tone = 'dark',
  maxWidth = 'max-w-6xl',
}: {
  left?: ReactNode
  children: ReactNode
  tone?: 'dark' | 'light'
  /** Maximum width class, aligned with the screen content. */
  maxWidth?: string
}) {
  return (
    <div
      className={`sticky bottom-0 z-10 shadow-barre ${
        tone === 'dark' ? 'sur-sombre bg-encre text-white' : 'border-t border-trait bg-surface text-encre-douce'
      }`}
    >
      <div className={`mx-auto flex min-h-20 flex-wrap items-center justify-between gap-4 px-6 py-3 ${maxWidth}`}>
        <div className="text-corps">{left}</div>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </div>
  )
}

/** CV template thumbnail: toggle button, with a check mark and the word « choisi » for the selected state. */
export function TemplateThumbnail({
  name,
  chosen,
  onChoose,
  children,
}: {
  name: string
  chosen: boolean
  onChoose: () => void
  /** Scaled-down preview of the template. */
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onChoose}
      className={`w-[104px] shrink-0 space-y-1.5 rounded-bouton bg-surface p-2 text-center transition duration-(--duree-rapide) ${
        chosen ? 'border-2 border-marque shadow-carte' : 'border border-trait p-[9px] hover:border-trait-fort'
      }`}
    >
      {children}
      <span className={`flex items-center justify-center gap-1 text-petit ${chosen ? 'font-bold' : ''}`}>
        {chosen && <Icon name="check" size={14} strokeWidth={3} />}
        {name}
        {chosen && <span className="sr-only"> (choisi)</span>}
      </span>
    </button>
  )
}
