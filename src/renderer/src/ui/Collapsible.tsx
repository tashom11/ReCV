import type { ReactNode } from 'react'
import { Icon } from './icons'

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
          {summaryLine && <span className="block text-petit text-aide">{summaryLine}</span>}
        </span>
        <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-5 pt-1 pb-5">{children}</div>
    </details>
  )
}
