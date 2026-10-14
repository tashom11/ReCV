import type { ReactNode } from 'react'
import { Icon } from './icons'

/** Short confirmation, announced to screen readers, to remove after a few seconds. */
export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-carte border border-succes/35 bg-succes-fond px-4 py-3 font-bold text-succes"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-champ bg-succes text-white">
        <Icon name="check" size={18} />
      </span>
      {children}
    </div>
  )
}
