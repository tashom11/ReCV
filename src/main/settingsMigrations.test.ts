import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Chiffreur, StockageParametres } from './parametres'
import { migrateSettings, SETTINGS_VERSION, type SettingsMigration } from './settingsMigrations'

const chiffreur: Chiffreur = {
  disponible: () => true,
  chiffrer: (t) => Buffer.from(t, 'utf8'),
  dechiffrer: (b) => Buffer.from(b).toString('utf8'),
}

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-param-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

describe('settings file versioning', () => {
  it('reads a v0.2.1 settings file (no version number)', async () => {
    await writeFile(
      join(dossier, 'parametres.json'),
      JSON.stringify({ fournisseur: 'ollama', modeleOllama: 'mistral', reformulerPuces: true }),
    )
    const lus = await new StockageParametres(dossier, chiffreur).lire()
    expect(lus).toMatchObject({ provider: 'ollama', ollamaModel: 'mistral', rewriteBullets: true })
  })

  it('writes the version number with the settings', async () => {
    const stockage = new StockageParametres(dossier, chiffreur)
    await stockage.enregistrer(await stockage.lire())
    const ecrit = JSON.parse(await readFile(join(dossier, 'parametres.json'), 'utf8'))
    expect(ecrit.version).toBe(SETTINGS_VERSION)
  })
})

describe('migrateSettings', () => {
  it('applies the missing steps in order', () => {
    const steps: SettingsMigration[] = [
      { version: 1, up: (s) => ({ ...s, trace: [...((s.trace as number[]) ?? []), 1] }) },
      { version: 2, up: (s) => ({ ...s, trace: [...((s.trace as number[]) ?? []), 2] }) },
    ]
    expect(migrateSettings({ version: 1, trace: [] }, steps)).toEqual({ version: 2, trace: [2] })
    expect(migrateSettings({}, steps)).toEqual({ version: 2, trace: [1, 2] })
  })

  it('leaves settings from a newer Re:CV as they are', () => {
    expect(migrateSettings({ version: 99, a: 1 }, [])).toEqual({ version: 99, a: 1 })
  })
})
