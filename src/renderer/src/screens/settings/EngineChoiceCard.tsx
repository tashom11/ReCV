import type { ReactNode } from 'react'

/** Selectable card (radio button): the whole block is clickable, the choice is outlined and named. */
export function EngineChoiceCard({
  chosen,
  onChoose,
  title,
  label,
  description,
  highlighted = false,
  children,
}: {
  chosen: boolean
  onChoose: () => void
  title: string
  label?: ReactNode
  description: string
  highlighted?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`rounded-carte ${
        chosen
          ? `border-2 border-marque ${highlighted ? 'bg-marque-pale' : 'bg-surface'}`
          : 'border border-trait bg-surface p-px'
      }`}
    >
      <label className="flex min-h-11 items-start gap-3.5 p-4">
        <input type="radio" name="engine" className="mt-1 size-5 shrink-0" checked={chosen} onChange={onChoose} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2.5 text-intro font-bold text-encre">
            {title}
            {label}
          </span>
          <span className="block text-corps text-encre-douce">{description}</span>
        </span>
      </label>
      {children && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  )
}
