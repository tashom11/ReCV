/** Raw content of the settings file, before validation by the settings schema. */
export type RawSettings = Record<string, unknown>

/** Turns settings of version `version - 1` into version `version`. Never edit a released step: add a new one. */
export interface SettingsMigration {
  version: number
  up: (settings: RawSettings) => RawSettings
}

export const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = [
  // Version 1: the v0.2.1 file, which had no version number. Nothing to change.
  { version: 1, up: (settings) => settings },
  // Version 2: code moved to English, settings keys too.
  {
    version: 2,
    up: (settings) => {
      const keys: Record<string, string> = {
        fournisseur: 'provider',
        modeleOllama: 'ollamaModel',
        urlOllama: 'ollamaUrl',
        urlApi: 'apiUrl',
        modeleApi: 'apiModel',
        reformulerPuces: 'rewriteBullets',
        modeleCv: 'cvTemplate',
        cheminModeleLocal: 'localModelPath',
      }
      return Object.fromEntries(Object.entries(settings).map(([key, value]) => [keys[key] ?? key, value]))
    },
  },
  // Version 3: CV template ids in English.
  {
    version: 3,
    up: (settings) => {
      const ids: Record<string, string> = {
        classique: 'classic',
        moderne: 'modern',
        bandeau: 'banner',
        lateral: 'sidebar',
      }
      const template = settings.cvTemplate
      return typeof template === 'string' && ids[template] ? { ...settings, cvTemplate: ids[template] } : settings
    },
  },
]

export const SETTINGS_VERSION = Math.max(...SETTINGS_MIGRATIONS.map((m) => m.version))

/** Brings raw settings to the latest version; settings from a newer Re:CV are left as they are. */
export function migrateSettings(
  settings: RawSettings,
  migrations: readonly SettingsMigration[] = SETTINGS_MIGRATIONS,
): RawSettings {
  const current = typeof settings.version === 'number' ? settings.version : 0
  return [...migrations]
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version)
    .reduce((acc, m) => ({ ...m.up(acc), version: m.version }), settings)
}
