import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type {
  ApiService,
  CvGenere,
  EtatModeles,
  EtatParametres,
  Parametres,
  ProfilEnregistre,
  ProgressionTache,
} from '@core/api'
import { construireModele, genererDocxCv, genererHtmlCv, nomFichierCv } from '@core/export'
import { creerFournisseurApi, creerFournisseurOllama, type FournisseurLLM } from '@core/llm'
import { recupererOffre } from '@core/offre'
import type { Offre, Profil } from '@core/schemas'
import type { Bdd } from './bdd/connexion'
import {
  creerProfil,
  effacerDonnees,
  enregistrerCv,
  enregistrerOffre,
  enregistrerProfil,
  obtenirProfilActif,
} from './bdd/depots'
import type { GestionnaireModeles } from './modeles/gestionnaire'
import type { StockageParametres } from './parametres'

export interface DependancesService {
  bdd: Bdd
  parametres: StockageParametres
  /** Ouvre le sélecteur de fichier et retourne le texte extrait du CV, ou `null` si annulé. */
  choisirEtLireCv: () => Promise<string | null>
  /** Repli de rendu navigateur pour les offres en JS. */
  rendreHtml: (url: string) => Promise<string>
  /** User-Agent de navigateur utilisé pour récupérer les offres. */
  userAgent?: string
  modeles: GestionnaireModeles
  /** Signale l'étape en cours d'une tâche longue au renderer. */
  emettreTache?: (progression: ProgressionTache) => void
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
export function creerService(deps: DependancesService): ApiService & { liberer(): Promise<void> } {
  const { bdd, parametres, modeles, choisirEtLireCv, rendreHtml, choisirDestination, genererPdf } = deps
  const creer = deps.creerFournisseur ?? fournisseurParDefaut
  const signaler = (progression: ProgressionTache) => deps.emettreTache?.(progression)

  // Un seul fournisseur vivant, réutilisé tant que les paramètres (et la clé) ne changent pas :
  // le modèle local pèse plusieurs Go et ne doit être chargé qu'une fois, puis libéré.
  let courant: { empreinte: string; promesse: Promise<FournisseurLLM> } | null = null

  const liberer = async (entree: typeof courant) => {
    const ancien = await entree?.promesse.catch(() => null)
    await ancien?.liberer?.()
  }

  const fournisseur = async (): Promise<FournisseurLLM> => {
    const [params, cleApi] = await Promise.all([parametres.lire(), parametres.lireCle()])
    const empreinte = createHash('sha256')
      .update(JSON.stringify([params, cleApi]))
      .digest('hex')
    if (courant?.empreinte !== empreinte) {
      const ancien = courant
      courant = null
      await liberer(ancien)
      const promesse = creer(params, cleApi)
      const entree = { empreinte, promesse }
      courant = entree
      // Une création en échec ne reste pas en cache : le prochain appel réessaie.
      promesse.catch(() => {
        if (courant === entree) courant = null
      })
    }
    if (!courant) throw new Error('Fournisseur indisponible')
    return courant.promesse
  }

  return {
    async importerCv(): Promise<ProfilEnregistre | null> {
      const texte = await choisirEtLireCv()
      if (texte === null) return null
      signaler({ tache: 'import', etape: 'Analyse du CV par le modèle' })
      const profil = await (await fournisseur()).extraireProfil(texte)
      return creerProfil(bdd, profil)
    },

    async obtenirProfil() {
      return obtenirProfilActif(bdd)
    },

    async enregistrerProfil(profil: Profil) {
      return enregistrerProfil(bdd, profil)
    },

    recupererOffre: (url: string) => recupererOffre(url, { rendreHtml, userAgent: deps.userAgent }),

    async analyserTexteOffre(texte: string): Promise<Offre> {
      signaler({ tache: 'offre', etape: 'Analyse de l’offre par le modèle' })
      return (await fournisseur()).extraireOffre(texte)
    },

    async adapterCv(offre: Offre): Promise<CvGenere> {
      const actif = obtenirProfilActif(bdd)
      if (!actif) throw new Error('Aucun profil : importe d’abord ton CV.')
      signaler({ tache: 'adaptation', etape: 'Préparation du modèle' })
      const cv = await (await fournisseur()).adapterCv(actif.profil, offre, {
        surEtape: (e) => signaler({ tache: 'adaptation', ...e }),
      })
      const offreId = enregistrerOffre(bdd, offre)
      return { id: enregistrerCv(bdd, actif.id, offreId, cv), offreId, cv }
    },

    async genererAccroche(profil: Profil) {
      signaler({ tache: 'accroche', etape: 'Repérage des compétences transversales' })
      return (await fournisseur()).genererAccroche(profil)
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

    async effacerDonnees() {
      effacerDonnees(bdd)
      await parametres.definirCle('')
    },

    liberer: () => liberer(courant),

    lireEtatModeles: (): Promise<EtatModeles> => modeles.etat(),
    telechargerModele: (id: string) => modeles.telecharger(id),
    annulerTelechargement: async () => modeles.annuler(),
    supprimerModele: (id: string) => modeles.supprimer(id),
  }
}
