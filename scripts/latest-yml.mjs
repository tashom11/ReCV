// Regenerates `latest.yml` for an installer signed afterwards: signing changes the file, hence its hash.
// electron-updater reads this file on the GitHub release to know which version to offer and to check it.
// Usage: node scripts/latest-yml.mjs <installer.exe> <version> [output file]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const [installer, version, output] = process.argv.slice(2)
if (!installer || !version) {
  console.error('Usage: node scripts/latest-yml.mjs <installer.exe> <version> [output file]')
  process.exit(1)
}

const content = readFileSync(installer)
const sha512 = createHash('sha512').update(content).digest('base64')
const name = basename(installer)
const yml = [
  `version: ${version}`,
  'files:',
  `  - url: ${name}`,
  `    sha512: ${sha512}`,
  `    size: ${content.length}`,
  `path: ${name}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n')

const destination = output ?? join(dirname(installer), 'latest.yml')
writeFileSync(destination, yml)
console.log(`${destination} written for ${name} (${content.length} bytes)`)
