// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

const dialog = (props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => (
  <ConfirmDialog
    open
    title="Tout effacer ?"
    confirmLabel="Oui, tout effacer"
    cancelLabel="Non, garder"
    onConfirm={() => undefined}
    onCancel={() => undefined}
    {...props}
  >
    <p>Explication</p>
  </ConfirmDialog>
)

describe('ConfirmDialog', () => {
  it('opens as a modal named by its title, with the focus on the safe choice', () => {
    render(dialog())
    const element = screen.getByRole('dialog', { name: 'Tout effacer ?' })
    expect((element as HTMLDialogElement).open).toBe(true)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Non, garder' }))
  })

  it('cancels with Escape, except while the action runs', () => {
    const onCancel = vi.fn()
    const { rerender } = render(dialog({ onCancel }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    rerender(dialog({ onCancel, busy: true }))
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('has no accessibility violation', async () => {
    render(dialog())
    await expectNoA11yViolations(screen.getByRole('dialog'))
  })
})
