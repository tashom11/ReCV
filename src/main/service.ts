import { writeFile } from 'node:fs/promises'
import type { ApiReCV, CvGenere, EtatParametres, Parametres, ProfilEnregistre } from '@core/api'
import { construireModele, genererDocxCv, genererHtmlCv, nomFichierCv } from '@core/export'
import { creerFournisseurApi, creerFournisseurOllama, type FournisseurLLM } from '@core/llm'
import { recupererOffre } from '@core/offre'
import type { Offre, Profil } from '@core/schemas'
import type { Bdd } from './bdd/connexion'
import { enregistrerCv, enregistrerOffre, enregistrerProfil, obtenirProfilActif } from './bdd/depots'
import type { StockageParametres } from './parametres'

export interface DependancesService {
  bdd: Bdd
  parametres: StockageParametres
  /** Ouvre le sélecteur de fichier et retourne le texte extrait du CV, ou `null` si annulé. */
  choisirEtLireCv: () => Promise<string | null>
  /** Repli de rendu navigateur pour les offres en JS. */
  rendreHtml: (url: string) => Promise<string>
  /** Sélecteur d'enregistrement : chemin choisi, ou `null` si annulé. */
  choisirDestination: (nomParDefaut: string, extension: 'pdf' | 'docx') => Promise<string | null>
  /** Rend le HTML en PDF (fenêtre cachée côté Electron). */
  genererPdf: (html: string) => Promise<Buffer>
  /** Surchargeable pour les tests (jamais d'appel LLM réel). */
  creerFournisseur?: (parametres: Parametres, cleApi: string | null) => Promise<FournisseurLLM>
}

async function fournisseurParDefaut(parametres: Parametres, cleApi: string | null): Promise<FournisseurLLM> {
  switch (parametres.fournisseur) {
    case 'ollama':
      return creerFournisseurOllama({ modele: parametres.modeleOllama, urlBase: parametres.urlOllama })
    case 'api':
      if (!cleApi) throw new Error('Aucune clé API configurée : renseigne-la dans les paramètres.')
      if (!parametres.modeleApi) throw new Error('Aucun modèle configuré pour le fournisseur API.')
      return creerFournisseurApi({ urlBase: parametres.urlApi, cleApi, modele: parametres.modeleApi })
    case 'local': {
      if (!parametres.cheminModeleLocal) throw new Error('Aucun modèle local sélectionné.')
      const { creerFournisseurLocal } = await import('@core/llm/moteurLocal')
      return creerFournisseurLocal({ cheminModele: parametres.cheminModeleLocal })
    }
  }
}

/** Logique des handlers IPC, sans dépendance directe à Electron (testable). */
export function creerService(deps: DependancesService): ApiReCV {
  const { bdd, parametres, choisirEtLireCv, rendreHtml, choisirDestination, genererPdf } = deps
  const creer = deps.creerFournisseur ?? fournisseurParDefaut

  const fournisseur = async () => creer(await parametres.lire(), await parametres.lireCle())

  return {
    async importerCv(): Promise<ProfilEnregistre | null> {
      const texte = await choisirEtLireCv()
      if (texte === null) return null
      const profil = await (await fournisseur()).extraireProfil(texte)
      return enregistrerProfil(bdd, profil)
    },

    async obtenirProfil() {
      return obtenirProfilActif(bdd)
    },

    async enregistrerProfil(profil: Profil) {
      return enregistrerProfil(bdd, profil)
    },

    recupererOffre: (url: string) => recupererOffre(url, { rendreHtml }),

    async analyserTexteOffre(texte: string): Promise<Offre> {
      return (await fournisseur()).extraireOffre(texte)
    },

    async adapterCv(offre: Offre): Promise<CvGenere> {
      const actif = obtenirProfilActif(bdd)
      if (!actif) throw new Error('Aucun profil : importe d’abord ton CV.')
      const cv = await (await fournisseur()).adapterCv(actif.profil, offre)
      const offreId = enregistrerOffre(bdd, offre)
      return { id: enregistrerCv(bdd, actif.id, offreId, cv), offreId, cv }
    },

    async exporterCv(cv, format) {
      const actif = obtenirProfilActif(bdd)
      if (!actif) throw new Error('Aucun profil : importe d’abord ton CV.')
      const modele = construireModele(actif.profil, cv)
      const chemin = await choisirDestination(nomFichierCv(modele, format), format)
      if (chemin === null) return null
      const contenu = format === 'pdf' ? await genererPdf(genererHtmlCv(modele)) : await genererDocxCv(modele)
      await writeFile(chemin, contenu)
      return chemin
    },

    lireParametres: (): Promise<EtatParametres> => parametres.etat(),
    enregistrerParametres: (p: Parametres) => parametres.enregistrer(p),
    definirCleApi: (cle: string) => parametres.definirCle(cle),
  }
}
