import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The landing page is served with a strict Content-Security-Policy (site/vercel.json). A browser enforces it: an inline
// style or script is silently dropped, and the page shows up broken in production (the illustration lost its widths
// and its pills) while it looks fine when the file is opened locally. These checks keep the page inside its own policy.
const html = readFileSync('site/index.html', 'utf8')
const policy = JSON.parse(readFileSync('site/vercel.json', 'utf8'))
  .headers.flatMap((entry) => entry.headers)
  .find((header) => header.key === 'Content-Security-Policy').value

describe('landing page and its Content-Security-Policy', () => {
  it('does not allow inline styles or scripts', () => {
    expect(policy).toContain("style-src 'self'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toContain('unsafe-inline')
  })

  it('has no inline style attribute (use a class or :nth-child in style.css)', () => {
    expect(html.match(/\sstyle\s*=/gi) ?? []).toEqual([])
  })

  it('has no <style> element', () => {
    expect(html).not.toMatch(/<style[\s>]/i)
  })

  it('has no inline script and no event handler attribute', () => {
    expect(html.match(/<script(?![^>]*\ssrc=)[^>]*>/gi) ?? []).toEqual([])
    expect(html.match(/\son[a-z]+\s*=/gi) ?? []).toEqual([])
  })

  it('animates the illustration from a stylesheet, over an SVG made of classes', () => {
    expect(html).toContain('href="hero-illustration.css"')
    const svg = html.slice(html.indexOf('<svg xmlns'), html.indexOf('</svg>', html.indexOf('<svg xmlns')))
    expect(svg).toContain('class="rv"')
    // Decorative: hidden from assistive technologies, no text of its own.
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toMatch(/<text|<title|<desc/)
  })
})
