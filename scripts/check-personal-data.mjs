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

const PHONE = /(?<![\d.])0[1-9](?:[ .-]?\d{2}){4}(?![\d])/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Personal data found in the given files: phone numbers, e-mail addresses, private patterns. */
export function findPersonalData(files, privatePatterns) {
  const patterns = privatePatterns.map((p) => fold(p.trim())).filter(Boolean)
  const found = []
  for (const { path, text } of files) {
    if (SKIPPED_FILES.has(path)) continue
    text.split('\n').forEach((content, index) => {
      const at = (kind, match) => found.push({ path, line: index + 1, kind, match })
      for (const [match] of content.matchAll(PHONE)) {
        if (!ALLOWED_PHONES.has(match.replace(/\D/g, ''))) at('phone', match)
      }
      if (!CONTACT_FILES.has(path)) {
        for (const [match] of content.matchAll(EMAIL)) {
          if (!ALLOWED_EMAIL_DOMAIN.test(match)) at('email', match)
        }
      }
      const folded = fold(content)
      for (const pattern of patterns) {
        const start = folded.indexOf(pattern)
        if (start !== -1) at('private', content.slice(start, start + pattern.length))
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
    console.error('Personal data must not enter the repository. Use fictitious data (exemple.fr, 06 12 34 56 78):')
    for (const f of found) console.error(`  ${f.path}:${f.line}  ${f.kind}  ${f.match}`)
    process.exit(1)
  }
  console.log(`No personal data found in ${files.length} files.`)
}
