// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { SegmentedTabs } from './SegmentedTabs'

afterEach(cleanup)

function Tabs({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a')
  return (
    <>
      <SegmentedTabs
        label="Mode"
        panelId="panel"
        value={value}
        onChange={setValue}
        disabled={disabled}
        tabs={[
          { id: 'a', label: 'Lien' },
          { id: 'b', label: 'Texte' },
          { id: 'c', label: 'Fichier' },
        ]}
      />
      <div id="panel" role="tabpanel" aria-labelledby={`panel-tab-${value}`}>
        {value}
      </div>
    </>
  )
}

describe('SegmentedTabs', () => {
  it('moves the choice and the focus with the arrows, Home and End (WAI-ARIA tabs)', () => {
    render(<Tabs />)
    const first = screen.getByRole('tab', { name: 'Lien' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Texte' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Texte' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Fichier' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Home' })
    expect(document.activeElement).toBe(first)
  })

  it('keeps only the selected tab in the tab order', () => {
    render(<Tabs />)
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([0, -1, -1])
  })

  it('stays focusable but inert while disabled', () => {
    render(<Tabs disabled />)
    const first = screen.getByRole('tab', { name: 'Lien' })
    expect(first.getAttribute('aria-disabled')).toBe('true')
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(first.getAttribute('aria-selected')).toBe('true')
  })

  it('has no accessibility violation', async () => {
    const { container } = render(<Tabs />)
    await expectNoA11yViolations(container)
  })
})
