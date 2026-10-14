import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabaseSafely } from './connection'
import { getActiveProfile } from './repositories'

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-bdd-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

describe('openDatabaseSafely', () => {
  it('opens a healthy database without making a backup', async () => {
    const { db, backupPath } = openDatabaseSafely(join(folder, 'recv.db'))
    expect(backupPath).toBeNull()
    expect(getActiveProfile(db)).toBeNull()
    db.close()
  })

  it('sets an unreadable database aside and starts from an empty one', async () => {
    const path = join(folder, 'recv.db')
    await writeFile(path, 'ceci n’est pas une base SQLite, mais un fichier abîmé '.repeat(100))

    const { db, backupPath } = openDatabaseSafely(path)

    expect(getActiveProfile(db)).toBeNull()
    expect(backupPath).not.toBeNull()
    expect(await readFile(backupPath as string, 'utf8')).toContain('fichier abîmé')
    expect((await readdir(folder)).filter((f) => f.startsWith('recv.db.unreadable-'))).toHaveLength(1)
    db.close()
  })
})
