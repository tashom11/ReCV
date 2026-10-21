// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { HeroIllustration } from './HeroIllustration'

afterEach(cleanup)

describe('HeroIllustration', () => {
  it('is decorative: hidden from assistive technologies, with no text and nothing focusable', () => {
    const { container } = render(<HeroIllustration />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('focusable')).toBe('false')
    expect(container.textContent).toBe('')
  })

  it('is animated by its stylesheet only: no inline style, no <style> element, no script', () => {
    const { container } = render(<HeroIllustration />)
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    expect(container.querySelectorAll('style, script, animate, foreignObject')).toHaveLength(0)
  })

  it('has no accessibility violation', async () => {
    const { container } = render(<HeroIllustration />)
    await expectNoA11yViolations(container)
  })
})
