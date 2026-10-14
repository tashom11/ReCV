import type { ReactNode } from 'react'
import { Icon } from './icons'

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
