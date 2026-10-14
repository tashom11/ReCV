import type { ReactNode } from 'react'
import { Icon } from './icons'

/**
 * CV template thumbnail: one radio of a single-choice group (WAI-ARIA radio pattern). Only the chosen one is in the
 * tab order; the group handles the arrow keys. The chosen state is also shown by a check mark and a bold name.
 */
export function TemplateThumbnail({
  id,
  name,
  chosen,
  onChoose,
  children,
}: {
  id: string
  name: string
  chosen: boolean
  onChoose: () => void
  /** Scaled-down preview of the template. */
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: rich preview card; WAI-ARIA radio pattern with a roving tabindex
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={chosen}
      tabIndex={chosen ? 0 : -1}
      onClick={onChoose}
      className={`w-[104px] shrink-0 space-y-1.5 rounded-bouton bg-surface p-2 text-center transition duration-(--duree-rapide) ${
        chosen ? 'border-2 border-marque shadow-carte' : 'border border-trait p-[9px] hover:border-trait-fort'
      }`}
    >
      {children}
      <span className={`flex items-center justify-center gap-1 text-petit ${chosen ? 'font-bold' : ''}`}>
        {chosen && <Icon name="check" size={14} strokeWidth={3} />}
        {name}
      </span>
    </button>
  )
}
