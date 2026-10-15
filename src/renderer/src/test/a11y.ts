import axe from 'axe-core'
import { expect } from 'vitest'

/** Fails with the list of WCAG A/AA violations found by axe in the rendered element. */
export async function expectNoA11yViolations(element: Element): Promise<void> {
  const results = await axe.run(element, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    // Colours depend on the stylesheet, which tests do not load: contrast is checked in the app.
    rules: { 'color-contrast': { enabled: false } },
  })
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
