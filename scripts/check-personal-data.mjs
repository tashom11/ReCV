// Refuses personal data in the repository: real phone numbers, real e-mail addresses, and the maintainers' own
// strings (name of an employer, a town…) listed OUTSIDE the repository. Test data must be fictitious.
//
// Usage: node scripts/check-personal-data.mjs [--staged]
//   --staged  only the files staged for the next commit (pre-commit hook); otherwise every tracked file.
// Private patterns, one per line, from the RECV_PRIVATE_PATTERNS variable (CI secret) or the untracked file
// `.private-patterns` at the repository root.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Fictitious numbers used by the tests.
const ALLOWED_PHONES = new Set(['0612345678', '0600000001', '0711223344'])
const ALLOWED_EMAIL_DOMAIN = /@(exemple\.(fr|com|org)|example\.(com|org|net)|users\.noreply\.github\.com)$/i
// Files where a real contact address is published on purpose.
const CONTACT_FILES = new Set(['CODE_OF_CONDUCT.md'])
const SKIPPED_FILES = new Set(['package-lock.json'])
// Public reference data, generated from an open source: the private patterns are not looked for there (the list of
// every French commune holds the maintainers' own town among 35,000 others and reveals nothing about them). Phone
// numbers and e-mail addresses are still checked.
const PUBLIC_DATA_FILES = new Set(['src/core/places/places.json'])

const PHONE = /(?<![\d.])0[1-9](?:[ .-]?\d{2}){4}(?![\d])/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Personal data found in the given files: phone numbers, e-mail addresses, private patterns. A private pattern is
 * reported by its position in the list (from 1), so that a report never has to quote it.
 */
export function findPersonalData(files, privatePatterns) {
  const patterns = privatePatterns
    .map((text, index) => ({ text: fold(text.trim()), number: index + 1 }))
    .filter((pattern) => pattern.text)
  const found = []
  for (const { path, text } of files) {
    if (SKIPPED_FILES.has(path)) continue
    const published = CONTACT_FILES.has(path)
    const patternsHere = PUBLIC_DATA_FILES.has(path) ? [] : patterns
    text.split('\n').forEach((line, index) => {
      // Where a contact address is published on purpose, the address itself is not scanned, the rest of the file is.
      const content = published ? line.replace(EMAIL, '') : line
      const at = (finding) => found.push({ path, line: index + 1, ...finding })
      for (const [match] of content.matchAll(PHONE)) {
        if (!ALLOWED_PHONES.has(match.replace(/\D/g, ''))) at({ kind: 'phone', match })
      }
      if (!published) {
        for (const [match] of content.matchAll(EMAIL)) {
          if (!ALLOWED_EMAIL_DOMAIN.test(match)) at({ kind: 'email', match })
        }
      }
      const folded = fold(content)
      for (const pattern of patternsHere) {
        const start = folded.indexOf(pattern.text)
        if (start !== -1) {
          at({ kind: 'private', match: content.slice(start, start + pattern.text.length), pattern: pattern.number })
        }
      }
    })
  }
  return found
}

function privatePatterns() {
  const fromEnv = process.env.RECV_PRIVATE_PATTERNS ?? ''
  const fromFile = existsSync('.private-patterns') ? readFileSync('.private-patterns', 'utf8') : ''
  return `${fromEnv}\n${fromFile}`.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith('#'))
}

function trackedFiles(staged) {
  const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR'] : ['ls-files']
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const staged = process.argv.includes('--staged')
  const files = trackedFiles(staged).flatMap((path) => {
    if (!existsSync(path)) return []
    const buffer = staged ? execFileSync('git', ['show', `:${path}`]) : readFileSync(path)
    return buffer.includes(0) ? [] : [{ path, text: buffer.toString('utf8') }]
  })
  const found = findPersonalData(files, privatePatterns())
  if (found.length > 0) {
    // The matched text is never printed: the CI logs and annotations of a public repository are public.
    console.error('Personal data must not enter the repository. Use fictitious data (exemple.fr, 06 12 34 56 78):')
    for (const f of found) {
      const what = f.pattern === undefined ? f.kind : `${f.kind} (private pattern #${f.pattern})`
      console.error(`  ${f.path}:${f.line}  ${what}`)
      // GitHub annotation: readable without opening the log. Never the matched text itself.
      if (process.env.GITHUB_ACTIONS)
        console.error(`::error file=${f.path},line=${f.line},title=Personal data::${what}`)
    }
    process.exit(1)
  }
  console.log(`No personal data found in ${files.length} files.`)
}
