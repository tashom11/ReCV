// Prints the CHANGELOG.md section of a version: the notes of its GitHub release.
// Usage: node scripts/release-notes.mjs <version or tag> > notes.md
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Body of the `## [version]` section, without its heading and without the link list at the end of the file. */
export function releaseNotes(changelog, version) {
  const wanted = version.replace(/^v/, '')
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`## [${wanted}]`))
  if (start === -1) throw new Error(`CHANGELOG.md has no section for version ${wanted}`)
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## ') || /^\[[^\]]+\]: /.test(line))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [version] = process.argv.slice(2)
  if (!version) {
    console.error('Usage: node scripts/release-notes.mjs <version or tag>')
    process.exit(1)
  }
  process.stdout.write(`${releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version)}\n`)
}
