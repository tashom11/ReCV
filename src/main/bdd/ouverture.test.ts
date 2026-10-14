import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabaseSafely } from './connexion'
import { obtenirProfilActif } from './depots'

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-bdd-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

describe('openDatabaseSafely', () => {
  it('opens a healthy database without making a backup', async () => {
    const { bdd, backupPath } = openDatabaseSafely(join(dossier, 'recv.db'))
    expect(backupPath).toBeNull()
    expect(obtenirProfilActif(bdd)).toBeNull()
    bdd.fermer()
  })

  it('sets an unreadable database aside and starts from an empty one', async () => {
    const chemin = join(dossier, 'recv.db')
    await writeFile(chemin, 'ceci n’est pas une base SQLite, mais un fichier abîmé '.repeat(100))

    const { bdd, backupPath } = openDatabaseSafely(chemin)

    expect(obtenirProfilActif(bdd)).toBeNull()
    expect(backupPath).not.toBeNull()
    expect(await readFile(backupPath as string, 'utf8')).toContain('fichier abîmé')
    expect((await readdir(dossier)).filter((f) => f.startsWith('recv.db.unreadable-'))).toHaveLength(1)
    bdd.fermer()
  })
})
