import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read as a file: Vitest replaces imported stylesheets (even `?raw`) with an empty string.
const css = readFileSync('src/renderer/src/ui/heroIllustration.css', 'utf8')

describe('heroIllustration.css', () => {
  it('shows the final state without motion when the user asked for less', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.rv \*\s*\{[^}]*animation: none !important/)
  })

  it('plays two cycles, then stops on the final state', () => {
    expect(css).toMatch(/--n: 2;/)
    expect(css).toMatch(/--a: [^;]*var\(--n\) both;/)
  })

  it('takes its colours from the theme of the application', () => {
    expect(css).toContain('var(--color-accent, #c9e265)')
    expect(css).not.toMatch(/var\(--(?!color-|n\)|a\)|y\)|s\)|o\))/)
  })

  it('has no remote resource and no inline-style trick', () => {
    expect(css).not.toMatch(/url\(|@import/)
  })
})
