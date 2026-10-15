// @vitest-environment happy-dom
import type { Language } from '@core/schemas'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import { LanguageList } from './LanguageList'

afterEach(cleanup)

let current: Language[] = []
function Harness() {
  const [languages, setLanguages] = useState<Language[]>([
    { name: 'Anglais', level: 'B2' },
    { name: 'Espagnol', level: 'A2' },
  ])
  current = languages
  return <LanguageList languages={languages} onChange={setLanguages} />
}

describe('LanguageList', () => {
  it('names the language each remove button removes', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Retirer la langue « Anglais »' })).toBeTruthy()
  })

  it('announces a removal, moves the focus to « Annuler », and puts the language back at its place', async () => {
    render(<Harness />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retirer la langue « Anglais »' })))
    expect(screen.getByRole('status').textContent).toContain('Élément retiré : « Anglais ».')
    const undo = screen.getByRole('button', { name: 'Annuler' })
    expect(document.activeElement).toBe(undo)
    expect(current.map((l) => l.name)).toEqual(['Espagnol'])
    await act(async () => fireEvent.click(undo))
    expect(current.map((l) => l.name)).toEqual(['Anglais', 'Espagnol'])
  })

  it('has no accessibility violation', async () => {
    const { container } = render(<Harness />)
    await expectNoA11yViolations(container)
  })
})
