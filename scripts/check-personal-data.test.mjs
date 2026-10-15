import { describe, expect, it } from 'vitest'
import { findPersonalData } from './check-personal-data.mjs'

// Realistic samples are built at run time: written out, they would trip the guard on this very file.
const PHONE = ['07', '45', '12', '88', '30'].join('.')
const EMAIL = ['jean.dupont', 'gmail.com'].join('@')

const scan = (text, privatePatterns = []) => findPersonalData([{ path: 'a.ts', text }], privatePatterns)

describe('findPersonalData', () => {
  it('accepts the fictitious phone numbers and test e-mail domains', () => {
    expect(scan("phone: '06 12 34 56 78', email: 'claire@exemple.fr', other: 'x@example.com'")).toEqual([])
  })

  it('flags any other phone number, whatever its separators', () => {
    expect(scan(`tel ${PHONE}`)).toEqual([{ path: 'a.ts', line: 1, kind: 'phone', match: PHONE }])
    expect(scan(`tel ${PHONE.replaceAll('.', '')}`)).toHaveLength(1)
  })

  it('flags a real-looking e-mail address', () => {
    expect(scan(`\ncontact: ${EMAIL}`)).toEqual([{ path: 'a.ts', line: 2, kind: 'email', match: EMAIL }])
  })

  it('flags the private patterns, ignoring case and accents typed differently', () => {
    expect(scan('company: "ACME Secret Corp"', ['acme secret corp'])).toEqual([
      { path: 'a.ts', line: 1, kind: 'private', match: 'ACME Secret Corp', pattern: 1 },
    ])
  })

  it('numbers the private patterns from 1, in the order of the list, so a report need not quote them', () => {
    const found = scan('un deux trois', ['', 'un', 'trois'])
    expect(found.map((f) => f.pattern)).toEqual([2, 3])
  })

  it('accepts a contact address only in the code of conduct, where it is published on purpose', () => {
    const coc = `contact at ${EMAIL}`
    expect(findPersonalData([{ path: 'CODE_OF_CONDUCT.md', text: coc }], [])).toEqual([])
    expect(findPersonalData([{ path: 'src/a.ts', text: coc }], [])).toHaveLength(1)
  })

  it('does not flag the published contact address against the private patterns, only the rest of that file', () => {
    const local = EMAIL.split('@')[0]
    const coc = `contact at ${EMAIL}
second line about ${local}-corp`
    const found = findPersonalData([{ path: 'CODE_OF_CONDUCT.md', text: coc }], [local])
    expect(found.map((f) => f.line)).toEqual([2])
  })
})
