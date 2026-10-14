import { type ReactNode, useEffect, useId, useRef } from 'react'
import { Button } from './Button'

/**
 * Confirmation of an action that cannot be undone. Native modal `<dialog>`: the focus stays inside, Escape cancels,
 * and the focus goes back to the button that opened it. The focus starts on the safe choice (cancel).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** The confirmed action is running: buttons disabled, Escape ignored. */
  busy?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      // Safe choice first: the cancel button (the last one).
      ;[...element.querySelectorAll('button')].at(-1)?.focus()
    }
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: closes like « cancel », unless the action is running.
        e.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto max-w-lg space-y-3 rounded-carte border-2 border-erreur bg-erreur-fond p-6 text-encre shadow-panneau backdrop:bg-encre/50"
    >
      <h2 id={titleId} className="font-titre text-intro font-bold text-erreur">
        {title}
      </h2>
      <div className="text-corps">{children}</div>
      <div className="flex flex-wrap gap-3 pt-1">
        <Button variant="danger-filled" onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      </div>
    </dialog>
  )
}
