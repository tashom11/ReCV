// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { ComboField, type Suggestion } from './ComboField'

afterEach(cleanup)

let current = ''
function Harness({ getSuggestions }: { getSuggestions: (typed: string) => Suggestion[] | Promise<Suggestion[]> }) {
  const [value, setValue] = useState('')
  current = value
  return <ComboField label="Ville ou département" value={value} onChange={setValue} getSuggestions={getSuggestions} />
}

const input = () => screen.getByRole('combobox', { name: 'Ville ou département' })
const type = async (text: string) => {
  await act(async () => fireEvent.change(input(), { target: { value: text } }))
}
const press = async (key: string) => {
  await act(async () => fireEvent.keyDown(input(), { key }))
}
const options = () => screen.queryAllByRole('option').map((option) => option.textContent)

const lyon = (): Suggestion[] => [
  { value: 'Lyon', detail: '69' },
  { value: 'Lyons-la-Forêt', detail: '27' },
]

describe('ComboField', () => {
  it('stays a plain field until something is typed, and shows the suggestions for what is typed', async () => {
    render(<Harness getSuggestions={lyon} />)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input().getAttribute('aria-expanded')).toBe('false')
    await type('lyo')
    expect(options()).toEqual(['Lyon 69', 'Lyons-la-Forêt 27'])
    expect(input().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('status').textContent).toBe('2 suggestions disponibles')
  })

  it('picks a suggestion with the arrows and Enter', async () => {
    render(<Harness getSuggestions={lyon} />)
    await type('lyo')
    // Nothing is selected automatically: Enter alone keeps what was typed.
    await press('Enter')
    expect(current).toBe('lyo')
    await press('ArrowDown')
    await press('ArrowDown')
    expect(input().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]?.id)
    await press('ArrowUp')
    await press('Enter')
    // Only the name is written: the code was there to tell homonyms apart.
    expect(current).toBe('Lyon')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks a suggestion with a click, without losing the focus', async () => {
    render(<Harness getSuggestions={lyon} />)
    input().focus()
    await type('lyo')
    const option = screen.getByRole('option', { name: 'Lyons-la-Forêt 27' })
    expect(fireEvent.mouseDown(option)).toBe(false)
    await act(async () => fireEvent.click(option))
    expect(current).toBe('Lyons-la-Forêt')
    expect(document.activeElement).toBe(input())
  })

  it('closes the list with Escape, without handing the key to what surrounds the field', async () => {
    const outer = vi.fn()
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test of the propagation of the key
      <div onKeyDown={outer}>
        <Harness getSuggestions={lyon} />
      </div>,
    )
    await type('lyo')
    await press('Escape')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(outer).not.toHaveBeenCalled()
    // Without a list, Escape goes on to the dialog around the field.
    await press('Escape')
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('closes the list when the field loses the focus', async () => {
    render(<Harness getSuggestions={lyon} />)
    await type('lyo')
    await act(async () => fireEvent.blur(input()))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows no list when there is no suggestion, or when finding them fails', async () => {
    const { rerender } = render(<Harness getSuggestions={() => []} />)
    await type('xyz')
    expect(screen.queryByRole('listbox')).toBeNull()
    rerender(<Harness getSuggestions={() => Promise.reject(new Error('list not loaded'))} />)
    await type('xyz2')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(current).toBe('xyz2')
  })

  it('ignores a late answer to an earlier keystroke', async () => {
    let answerFirst: (items: Suggestion[]) => void = () => undefined
    const getSuggestions = (typed: string) =>
      typed === 'l' ? new Promise<Suggestion[]>((resolve) => (answerFirst = resolve)) : [{ value: 'Lyon' }]
    render(<Harness getSuggestions={getSuggestions} />)
    await type('l')
    await type('ly')
    await act(async () => answerFirst([{ value: 'Lille' }]))
    expect(options()).toEqual(['Lyon'])
  })

  it('has no accessibility violation, closed or open', async () => {
    const { container } = render(<Harness getSuggestions={lyon} />)
    await expectNoA11yViolations(container)
    await type('lyo')
    await press('ArrowDown')
    await expectNoA11yViolations(container)
  })
})
