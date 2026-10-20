// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { CvImportStep } from './CvImportStep'

afterEach(cleanup)

const props = {
  error: null,
  onErrorAction: () => undefined,
  importing: false,
  showProgressStep: false,
  online: false,
  onFile: () => undefined,
  onChoose: () => undefined,
  onCreate: () => undefined,
}

describe('CvImportStep', () => {
  it('offers to import a CV and to create one, side by side', () => {
    render(<CvImportStep {...props} />)
    expect(screen.getByText('Glissez votre CV ici')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Pas de CV ? Créez-en un !' })).toBeTruthy()
  })

  it('starts a CV from scratch with « Créer mon CV »', () => {
    const onCreate = vi.fn()
    const onChoose = vi.fn()
    render(<CvImportStep {...props} onCreate={onCreate} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon CV' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('shows only the progress while a CV is being read', () => {
    render(<CvImportStep {...props} importing />)
    expect(screen.queryByRole('button', { name: 'Créer mon CV' })).toBeNull()
    expect(screen.queryByText('Glissez votre CV ici')).toBeNull()
  })

  it('has no accessibility violation', async () => {
    const { container } = render(<CvImportStep {...props} />)
    await expectNoA11yViolations(container)
  })
})
