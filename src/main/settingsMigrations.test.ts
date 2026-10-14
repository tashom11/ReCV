import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateSettings, SETTINGS_VERSION, type SettingsMigration } from './settingsMigrations'
import { type Encryptor, SettingsStore } from './settingsStore'

const encryptor: Encryptor = {
  isAvailable: () => true,
  encrypt: (t) => Buffer.from(t, 'utf8'),
  decrypt: (b) => Buffer.from(b).toString('utf8'),
}

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-param-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

describe('settings file versioning', () => {
  it('reads a v0.2.1 settings file (no version number)', async () => {
    await writeFile(
      join(folder, 'settings.json'),
      JSON.stringify({ fournisseur: 'ollama', modeleOllama: 'mistral', reformulerPuces: true }),
    )
    const loaded = await new SettingsStore(folder, encryptor).read()
    expect(loaded).toMatchObject({ provider: 'ollama', ollamaModel: 'mistral', rewriteBullets: true })
  })

  it('writes the version number with the settings', async () => {
    const store = new SettingsStore(folder, encryptor)
    await store.save(await store.read())
    const written = JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'))
    expect(written.version).toBe(SETTINGS_VERSION)
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
