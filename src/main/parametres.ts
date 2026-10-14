import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Settings, type SettingsState, settingsSchema, urlOrigin } from '@core/api'
import { migrateSettings, SETTINGS_VERSION } from './settingsMigrations'

/** Abstraction de `safeStorage` d'Electron (injectable pour les tests). */
export interface Chiffreur {
  disponible(): boolean
  chiffrer(texte: string): Buffer
  dechiffrer(donnees: Buffer): string
}

/**
 * Paramètres en JSON clair + clé API chiffrée dans un fichier séparé.
 * Sans chiffrement disponible, la clé est refusée : jamais écrite en clair.
 */
export class StockageParametres {
  constructor(
    private readonly dossier: string,
    private readonly chiffreur: Chiffreur,
  ) {}

  private get fichierParametres(): string {
    return join(this.dossier, 'parametres.json')
  }

  private get fichierCle(): string {
    return join(this.dossier, 'cle-api.bin')
  }

  async lire(): Promise<Settings> {
    try {
      return settingsSchema.parse(migrateSettings(JSON.parse(await readFile(this.fichierParametres, 'utf8'))))
    } catch {
      return settingsSchema.parse({})
    }
  }

  async etat(): Promise<SettingsState> {
    return { ...(await this.lire()), hasApiKey: existsSync(this.fichierCle) }
  }

  async enregistrer(parametres: Settings): Promise<SettingsState> {
    const valides = settingsSchema.parse(parametres)
    // La clé est liée à la destination : si l'adresse de l'API change d'origine, elle est supprimée,
    // pour qu'une modification des paramètres ne puisse pas rediriger la clé vers un autre serveur.
    const precedente = (await this.lire()).apiUrl
    if (urlOrigin(precedente) !== urlOrigin(valides.apiUrl)) await rm(this.fichierCle, { force: true })
    await mkdir(this.dossier, { recursive: true })
    await writeFile(this.fichierParametres, JSON.stringify({ version: SETTINGS_VERSION, ...valides }, null, 2))
    return this.etat()
  }

  /** Chaîne vide : supprime la clé. */
  async definirCle(cle: string): Promise<SettingsState> {
    if (cle === '') {
      await rm(this.fichierCle, { force: true })
      return this.etat()
    }
    if (!this.chiffreur.disponible()) {
      throw new Error('Le chiffrement du système est indisponible : la clé API ne peut pas être stockée en sécurité.')
    }
    await mkdir(this.dossier, { recursive: true })
    await writeFile(this.fichierCle, this.chiffreur.chiffrer(cle))
    return this.etat()
  }

  /** Réservé au process principal : ne jamais renvoyer au renderer. */
  async lireCle(): Promise<string | null> {
    try {
      return this.chiffreur.dechiffrer(await readFile(this.fichierCle))
    } catch {
      return null
    }
  }
}
