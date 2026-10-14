import type { ReactNode } from 'react'

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
