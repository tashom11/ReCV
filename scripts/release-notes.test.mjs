import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { releaseNotes } from './release-notes.mjs'

const changelog = `# Changelog

Intro.

## [0.3.0] - 2026-10-14

### Added
- New thing.

## [0.2.1] - 2026-10-13

### Fixed
- Old fix.

[0.3.0]: https://example.com/compare
[0.2.1]: https://example.com/compare-old
`

describe('releaseNotes', () => {
  it('returns the section of one version, without its heading nor the link list', () => {
    expect(releaseNotes(changelog, '0.3.0')).toBe('### Added\n- New thing.')
    expect(releaseNotes(changelog, '0.2.1')).toBe('### Fixed\n- Old fix.')
  })

  it('accepts a tag name', () => {
    expect(releaseNotes(changelog, 'v0.3.0')).toBe('### Added\n- New thing.')
  })

  it('fails when the version has no section: a release never ships without notes', () => {
    expect(() => releaseNotes(changelog, '9.9.9')).toThrow(/9\.9\.9/)
  })

  it('finds the current version in the real changelog', () => {
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version
    expect(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version).length).toBeGreaterThan(0)
  })
})
