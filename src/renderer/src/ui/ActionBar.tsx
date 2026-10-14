import type { ReactNode } from 'react'

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
