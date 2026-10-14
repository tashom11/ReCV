import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelDownloadProgress, ModelsState } from '@core/api'
import { isModelCompatible, LOCAL_MODELS, type LocalModel, type Resources, recommendModel } from '@core/llm'
import { telechargerFichier } from './telechargement'

export interface DependancesGestionnaire {
  /** `<userData>/modeles` */
  dossier: string
  ressources: () => Promise<Resources>
  emettre: (progression: ModelDownloadProgress) => void
  /** Appelé quand un modèle vient d'être installé (ex. le sélectionner dans les paramètres). */
  apresInstallation?: (chemin: string, modele: LocalModel) => Promise<void>
  telecharger?: typeof telechargerFichier
}

const INTERVALLE_PROGRESSION_MS = 200

export class GestionnaireModeles {
  private courant: { id: string; annuler: AbortController; derniere: ModelDownloadProgress } | null = null

  constructor(private readonly deps: DependancesGestionnaire) {}

  private trouver(id: string): LocalModel {
    const modele = LOCAL_MODELS.find((m) => m.id === id)
    if (!modele) throw new Error(`Modèle inconnu : ${id}`)
    return modele
  }

  cheminModele(modele: LocalModel): string {
    return join(this.deps.dossier, modele.fileName)
  }

  private async estInstalle(modele: LocalModel): Promise<boolean> {
    try {
      return (await stat(this.cheminModele(modele))).size === modele.sizeBytes
    } catch {
      return false
    }
  }

  async etat(): Promise<ModelsState> {
    const ressources = await this.deps.ressources()
    const recommande = recommendModel(ressources)
    const modeles = await Promise.all(
      LOCAL_MODELS.map(async (m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sizeBytes: m.sizeBytes,
        path: this.cheminModele(m),
        installed: await this.estInstalle(m),
        recommended: m.id === recommande.id,
        compatible: isModelCompatible(m, ressources),
      })),
    )
    return { ...ressources, models: modeles, download: this.courant?.derniere ?? null }
  }

  /** Un seul téléchargement à la fois. Résout une fois le fichier vérifié et en place. */
  async telecharger(id: string): Promise<void> {
    if (this.courant) throw new Error('Un téléchargement est déjà en cours.')
    const modele = this.trouver(id)
    const annuler = new AbortController()
    const etat = { id, annuler, derniere: this.progression(id, 0, modele.sizeBytes, 'en-cours') }
    this.courant = etat

    const emettre = (p: ModelDownloadProgress) => {
      etat.derniere = p
      this.deps.emettre(p)
    }
    let dernierEnvoi = 0

    try {
      emettre(etat.derniere)
      await (this.deps.telecharger ?? telechargerFichier)({
        url: modele.url,
        destination: this.cheminModele(modele),
        tailleOctets: modele.sizeBytes,
        sha256: modele.sha256,
        signal: annuler.signal,
        surProgression: (recu, total) => {
          const maintenant = Date.now()
          if (maintenant - dernierEnvoi < INTERVALLE_PROGRESSION_MS && recu < total) return
          dernierEnvoi = maintenant
          // À 100 %, le fichier est encore haché puis renommé.
          emettre(this.progression(id, recu, total, recu >= total ? 'verification' : 'en-cours'))
        },
      })
      await this.deps.apresInstallation?.(this.cheminModele(modele), modele)
      emettre(this.progression(id, modele.sizeBytes, modele.sizeBytes, 'termine'))
    } catch (erreur) {
      if (annuler.signal.aborted) {
        emettre({ ...etat.derniere, status: 'annule' })
      } else {
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        emettre({ ...etat.derniere, status: 'erreur', message })
        throw erreur
      }
    } finally {
      this.courant = null
    }
  }

  /** Le fichier partiel est conservé : le prochain téléchargement reprend où il s'est arrêté. */
  annuler(): void {
    this.courant?.annuler.abort()
  }

  async supprimer(id: string): Promise<void> {
    const modele = this.trouver(id)
    if (this.courant?.id === id) throw new Error('Téléchargement en cours : mettez-le d’abord en pause.')
    await rm(this.cheminModele(modele), { force: true })
    await rm(`${this.cheminModele(modele)}.part`, { force: true })
  }

  private progression(id: string, recuOctets: number, totalOctets: number, etat: ModelDownloadProgress['status']) {
    return { id, receivedBytes: recuOctets, totalBytes: totalOctets, status: etat } satisfies ModelDownloadProgress
  }
}
