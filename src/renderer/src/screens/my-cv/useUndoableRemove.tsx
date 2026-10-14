import { useEffect, useRef, useState } from 'react'
import { insertAt } from './profileDraft'

/**
 * Removal of a list item that can be undone. After a removal, a status line names what was removed and offers
 * « Annuler »; the focus moves to that button, so it is not lost with the removed item (WCAG 2.4.3).
 */
export function useUndoableRemove<T>(items: T[], onChange: (items: T[]) => void, describe: (item: T) => string) {
  const [removed, setRemoved] = useState<{ index: number; item: T; label: string } | null>(null)
  const undoButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (removed) undoButton.current?.focus()
  }, [removed])

  const remove = (index: number) => {
    const item = items[index]
    if (item === undefined) return
    setRemoved({ index, item, label: describe(item) })
    onChange(items.filter((_, i) => i !== index))
  }

  const undo = () => {
    if (!removed) return
    onChange(insertAt(items, removed.index, removed.item))
    setRemoved(null)
  }

  const notice = removed && (
    <p role="status" className="flex flex-wrap items-center gap-3 rounded-champ bg-creux px-4 py-2.5 text-corps">
      <span>Élément retiré : « {removed.label} ».</span>
      <button
        ref={undoButton}
        type="button"
        onClick={undo}
        className="min-h-11 rounded-champ font-bold text-marque underline underline-offset-4 hover:text-marque-survol"
      >
        Annuler
      </button>
    </p>
  )

  return { remove, notice }
}
