import type { ReactNode } from 'react'
import { Icon } from './icons'

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
