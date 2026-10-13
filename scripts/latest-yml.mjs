// Régénère `latest.yml` pour un installeur signé après coup : la signature change le fichier, donc son empreinte.
// electron-updater lit ce fichier sur la release GitHub pour savoir quelle version proposer et la vérifier.
// Usage : node scripts/latest-yml.mjs <installeur.exe> <version> [fichier de sortie]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const [installeur, version, sortie] = process.argv.slice(2)
if (!installeur || !version) {
  console.error('Usage : node scripts/latest-yml.mjs <installeur.exe> <version> [fichier de sortie]')
  process.exit(1)
}

const contenu = readFileSync(installeur)
const sha512 = createHash('sha512').update(contenu).digest('base64')
const nom = basename(installeur)
const yml = [
  `version: ${version}`,
  'files:',
  `  - url: ${nom}`,
  `    sha512: ${sha512}`,
  `    size: ${contenu.length}`,
  `path: ${nom}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  '',
].join('\n')

const destination = sortie ?? join(dirname(installeur), 'latest.yml')
writeFileSync(destination, yml)
console.log(`${destination} écrit pour ${nom} (${contenu.length} octets)`)
