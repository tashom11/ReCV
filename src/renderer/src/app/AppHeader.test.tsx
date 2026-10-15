// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { AppHeader } from './AppHeader'

afterEach(cleanup)

const header = (notifications: number) => (
  <AppHeader
    view="posting"
    done={[1]}
    hasUndownloadedCv={false}
    notifications={notifications}
    onGoToStep={() => undefined}
    onSettings={() => undefined}
    onBack={() => undefined}
  />
)

describe('AppHeader', () => {
  it('shows a red badge on the settings button when an update is ready, said in words to screen readers', () => {
    render(header(1))
    const settings = screen.getByRole('button', { name: 'Réglages (1 mise à jour prête)' })
    expect(settings.querySelector('[aria-hidden="true"].bg-erreur')?.textContent).toBe('1')
  })

  it('shows no badge without a notification', () => {
    render(header(0))
    const settings = screen.getByRole('button', { name: 'Réglages' })
    expect(settings.querySelector('.bg-erreur')).toBeNull()
  })

  it('has no accessibility violation', async () => {
    const { container } = render(header(1))
    await expectNoA11yViolations(container)
  })
})
