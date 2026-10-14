import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Settings, type SettingsState, settingsSchema, urlOrigin } from '@core/api'
import { DATA_FILES } from './dataFolder'
import { migrateSettings, SETTINGS_VERSION } from './settingsMigrations'

/** Abstraction of Electron's `safeStorage` (injectable for tests). */
export interface Encryptor {
  isAvailable(): boolean
  encrypt(text: string): Buffer
  decrypt(data: Buffer): string
}

/**
 * Settings in plain JSON + API key encrypted in a separate file.
 * Without available encryption, the key is refused: never written in clear.
 */
export class SettingsStore {
  constructor(
    private readonly folder: string,
    private readonly encryptor: Encryptor,
  ) {}

  private get settingsFile(): string {
    return join(this.folder, DATA_FILES.settings)
  }

  private get keyFile(): string {
    return join(this.folder, DATA_FILES.apiKey)
  }

  async read(): Promise<Settings> {
    try {
      return settingsSchema.parse(migrateSettings(JSON.parse(await readFile(this.settingsFile, 'utf8'))))
    } catch {
      return settingsSchema.parse({})
    }
  }

  async state(): Promise<SettingsState> {
    return { ...(await this.read()), hasApiKey: existsSync(this.keyFile) }
  }

  async save(settings: Settings): Promise<SettingsState> {
    const validated = settingsSchema.parse(settings)
    // The key is bound to its destination: if the API address changes origin, the key is deleted, so that a settings
    // change cannot redirect the key to another server.
    const previousSettings = (await this.read()).apiUrl
    if (urlOrigin(previousSettings) !== urlOrigin(validated.apiUrl)) await rm(this.keyFile, { force: true })
    await mkdir(this.folder, { recursive: true })
    await writeFile(this.settingsFile, JSON.stringify({ version: SETTINGS_VERSION, ...validated }, null, 2))
    return this.state()
  }

  /** Empty string: deletes the key. */
  async setKey(key: string): Promise<SettingsState> {
    if (key === '') {
      await rm(this.keyFile, { force: true })
      return this.state()
    }
    if (!this.encryptor.isAvailable()) {
      throw new Error('Le chiffrement du système est indisponible : la clé API ne peut pas être stockée en sécurité.')
    }
    await mkdir(this.folder, { recursive: true })
    await writeFile(this.keyFile, this.encryptor.encrypt(key))
    return this.state()
  }

  /** Main process only: never send it back to the renderer. */
  async readKey(): Promise<string | null> {
    try {
      return this.encryptor.decrypt(await readFile(this.keyFile))
    } catch {
      return null
    }
  }
}
