import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { EtatModeles, ProgressionModele } from '@core/api'
import { MODELES_EMBARQUES, type ModeleEmbarque, modeleCompatible, proposerModele, type Ressources } from '@core/llm'
import { telechargerFichier } from './telechargement'

export interface DependancesGestionnaire {
  /** `<userData>/modeles` */
  dossier: string
  ressources: () => Promise<Ressources>
  emettre: (progression: ProgressionModele) => void
  /** Appelé quand un modèle vient d'être installé (ex. le sélectionner dans les paramètres). */
  apresInstallation?: (chemin: string, modele: ModeleEmbarque) => Promise<void>
  telecharger?: typeof telechargerFichier
}

const INTERVALLE_PROGRESSION_MS = 200

export class GestionnaireModeles {
  private courant: { id: string; annuler: AbortController; derniere: ProgressionModele } | null = null

  constructor(private readonly deps: DependancesGestionnaire) {}

  private trouver(id: string): ModeleEmbarque {
    const modele = MODELES_EMBARQUES.find((m) => m.id === id)
    if (!modele) throw new Error(`Modèle inconnu : ${id}`)
    return modele
  }

  cheminModele(modele: ModeleEmbarque): string {
    return join(this.deps.dossier, modele.fichier)
  }

  private async estInstalle(modele: ModeleEmbarque): Promise<boolean> {
    try {
      return (await stat(this.cheminModele(modele))).size === modele.tailleOctets
    } catch {
      return false
    }
  }

  async etat(): Promise<EtatModeles> {
    const ressources = await this.deps.ressources()
    const recommande = proposerModele(ressources)
    const modeles = await Promise.all(
      MODELES_EMBARQUES.map(async (m) => ({
        id: m.id,
        nom: m.nom,
        description: m.description,
        tailleOctets: m.tailleOctets,
        chemin: this.cheminModele(m),
        installe: await this.estInstalle(m),
        recommande: m.id === recommande.id,
        compatible: modeleCompatible(m, ressources),
      })),
    )
    return { ...ressources, modeles, telechargement: this.courant?.derniere ?? null }
  }

  /** Un seul téléchargement à la fois. Résout une fois le fichier vérifié et en place. */
  async telecharger(id: string): Promise<void> {
    if (this.courant) throw new Error('Un téléchargement est déjà en cours.')
    const modele = this.trouver(id)
    const annuler = new AbortController()
    const etat = { id, annuler, derniere: this.progression(id, 0, modele.tailleOctets, 'en-cours') }
    this.courant = etat

    const emettre = (p: ProgressionModele) => {
      etat.derniere = p
      this.deps.emettre(p)
    }
    let dernierEnvoi = 0

    try {
      emettre(etat.derniere)
      await (this.deps.telecharger ?? telechargerFichier)({
        url: modele.url,
        destination: this.cheminModele(modele),
        tailleOctets: modele.tailleOctets,
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
      emettre(this.progression(id, modele.tailleOctets, modele.tailleOctets, 'termine'))
    } catch (erreur) {
      if (annuler.signal.aborted) {
        emettre({ ...etat.derniere, etat: 'annule' })
      } else {
        const message = erreur instanceof Error ? erreur.message : String(erreur)
        emettre({ ...etat.derniere, etat: 'erreur', message })
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

  private progression(id: string, recuOctets: number, totalOctets: number, etat: ProgressionModele['etat']) {
    return { id, recuOctets, totalOctets, etat } satisfies ProgressionModele
  }
}
