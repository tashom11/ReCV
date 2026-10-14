import { readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/** Names of the files in the data folder (`userData`). */
export const DATA_FILES = {
  database: 'recv.db',
  settings: 'settings.json',
  apiKey: 'api-key.bin',
  models: 'models',
} as const

// Names used up to v0.2.1.
const RENAMES: [string, string][] = [
  ['parametres.json', DATA_FILES.settings],
  ['cle-api.bin', DATA_FILES.apiKey],
  ['modeles', DATA_FILES.models],
]

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

/**
 * Gives the v0.2.1 data files their English names, once. The selected local model, stored with its full path in the
 * settings, follows the models folder. Anything already renamed, or missing, is left alone.
 */
export async function migrateDataFolder(folder: string): Promise<void> {
  for (const [from, to] of RENAMES) {
    if ((await exists(join(folder, from))) && !(await exists(join(folder, to)))) {
      await rename(join(folder, from), join(folder, to))
    }
  }

  const settingsFile = join(folder, DATA_FILES.settings)
  if (!(await exists(settingsFile))) return
  const settings = JSON.parse(await readFile(settingsFile, 'utf8')) as Record<string, unknown>
  const oldModels = join(folder, 'modeles')
  let changed = false
  // A v0.2.1 file still has the French key: the settings migration renames it later, on first read.
  for (const key of ['localModelPath', 'cheminModeleLocal']) {
    const value = settings[key]
    if (typeof value !== 'string') continue
    const inside = relative(oldModels, value)
    if (inside === '' || inside.startsWith('..') || inside.startsWith(sep) || /^[a-z]:/i.test(inside)) continue
    settings[key] = join(folder, DATA_FILES.models, inside)
    changed = true
  }
  if (changed) await writeFile(settingsFile, JSON.stringify(settings, null, 2))
}
