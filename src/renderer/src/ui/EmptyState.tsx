import type { ReactNode } from 'react'

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
