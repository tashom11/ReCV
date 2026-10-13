import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { type AnalyseOffre, analyserCouverture, preparerProfil } from '@core/adaptation'
import { formaterCompetence } from '@core/adaptation/competences'
import type {
  ApercuAnnonce,
  ApiService,
  CvGenere,
  EtatModeles,
  EtatParametres,
  Parametres,
  ProfilEnregistre,
  ProgressionTache,
} from '@core/api'
import { ErreurCodee } from '@core/erreurs'
import {
  construireModele,
  genererDocxCv,
  genererHtmlCv,
  type IdModele,
  nomFichierCv,
  trouverModele,
} from '@core/export'
import { creerFournisseurApi, creerFournisseurOllama, type FournisseurLLM } from '@core/llm'
import { recupererOffre, repererContrat } from '@core/offre'
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
import type { GestionnaireMiseAJour } from './miseAJour'
import type { GestionnaireModeles } from './modeles/gestionnaire'
import type { StockageParametres } from './parametres'

export interface DependancesService {
  bdd: Bdd
  parametres: StockageParametres
  /** Ouvre le sélecteur de fichier et retourne le texte extrait du CV et le nom du fichier, ou `null` si annulé. */
  choisirEtLireCv: () => Promise<{ texte: string; nom: string } | null>
  /** Texte extrait d'un CV désigné par son chemin (fichier déposé dans la fenêtre). */
  lireCv: (chemin: string) => Promise<string>
  /** Repli de rendu navigateur pour les offres en JS. */
  rendreHtml: (url: string) => Promise<string>
  /** User-Agent de navigateur utilisé pour récupérer les offres. */
  userAgent?: string
  modeles: GestionnaireModeles
  misesAJour: Pick<GestionnaireMiseAJour, 'etat' | 'verifier' | 'installer'>
  /** Signale l'étape en cours d'une tâche longue au renderer. */
  emettreTache?: (progression: ProgressionTache) => void
  /** Sélecteur d'enregistrement : chemin choisi, ou `null` si annulé. */
  choisirDestination: (nomParDefaut: string, extension: 'pdf' | 'docx') => Promise<string | null>
  /** Rend le HTML en PDF (fenêtre cachée côté Electron). */
  genererPdf: (html: string) => Promise<Buffer>
  /** Ouvre un fichier avec l'application par défaut du système. */
  ouvrirChemin: (chemin: string) => Promise<void>
  /** Montre un fichier dans l'explorateur. */
  montrerChemin: (chemin: string) => void
  /** Surchargeable pour les tests (jamais d'appel LLM réel). */
  creerFournisseur?: (parametres: Parametres, cleApi: string | null) => Promise<FournisseurLLM>
}

const MAX_RECHERCHEES = 8

async function fournisseurParDefaut(parametres: Parametres, cleApi: string | null): Promise<FournisseurLLM> {
  switch (parametres.fournisseur) {
    case 'ollama':
      return creerFournisseurOllama({ modele: parametres.modeleOllama, urlBase: parametres.urlOllama })
    case 'api':
      if (!cleApi) throw new Error('Aucune clé personnelle enregistrée : renseignez-la dans les réglages.')
      if (!parametres.modeleApi) throw new Error('Aucun modèle indiqué pour le service en ligne.')
      return creerFournisseurApi({ urlBase: parametres.urlApi, cleApi, modele: parametres.modeleApi })
    case 'local': {
      if (!parametres.cheminModeleLocal) throw new ErreurCodee('moteur-absent', 'Aucun modèle local sélectionné.')
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
  const analyses = new Map<string, AnalyseOffre>()
  // Seuls les fichiers écrits par l'export de cette session peuvent être ouverts : le renderer ne choisit pas le chemin.
  const exportes = new Set<string>()
  let adaptationEnCours: AbortController | null = null

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

  const profilActif = () => {
    const actif = obtenirProfilActif(bdd)
    if (!actif) throw new ErreurCodee('profil-absent', 'Aucun CV enregistré : importez d’abord votre CV.')
    return actif
  }

  const importer = async (texte: string, nomFichier: string): Promise<ProfilEnregistre> => {
    signaler({ tache: 'import', etape: 'Analyse du CV par le modèle' })
    const extrait = await (await fournisseur()).extraireProfil(texte)
    // La photo est choisie par l'utilisateur, pas extraite du CV : elle suit le profil actif.
    const photo = obtenirProfilActif(bdd)?.profil.photo
    return { ...creerProfil(bdd, photo ? { ...extrait, photo } : extrait), nomFichier }
  }

  // L'analyse d'une offre ne dépend pas du profil : mémorisée, elle sert à la carte de confirmation de l'annonce
  // puis à l'adaptation, sans second appel au modèle.
  const cleOffre = (offre: Offre) =>
    createHash('sha256').update(`${offre.titrePoste}\n${offre.texteBrut}`).digest('hex')
  const memoriser = (cle: string, analyse: AnalyseOffre) => {
    analyses.set(cle, analyse)
    if (analyses.size > 20) analyses.delete(analyses.keys().next().value as string)
  }

  const verifierExporte = (chemin: string): string => {
    const absolu = resolve(chemin)
    if (!exportes.has(absolu)) throw new Error('Ce fichier n’a pas été créé par Re:CV pendant cette session.')
    return absolu
  }

  return {
    async importerCv(): Promise<ProfilEnregistre | null> {
      const choisi = await choisirEtLireCv()
      return choisi === null ? null : importer(choisi.texte, choisi.nom)
    },

    async importerCvDepose(chemin: string): Promise<ProfilEnregistre> {
      return importer(await deps.lireCv(chemin), basename(chemin))
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

    async analyserAnnonce(offre: Offre): Promise<ApercuAnnonce> {
      const actif = profilActif()
      const cle = cleOffre(offre)
      let analyse = analyses.get(cle)
      if (!analyse) {
        signaler({ tache: 'offre', etape: 'Repérage de ce que l’employeur recherche' })
        analyse = await (await fournisseur()).analyserOffre(offre)
        memoriser(cle, analyse)
      }
      const couverture = analyserCouverture(preparerProfil(actif.profil), analyse)
      // Ordre de l'annonce (savoir-faire, qualités, autres termes), limité à ce que la couverture a retenu.
      const retenues = new Set([...couverture.attestees, ...couverture.manquantes])
      const recherchees = [...analyse.competencesRequises, ...analyse.qualites, ...analyse.motsCles]
        .map((terme) => terme.trim())
        .filter((terme, i, tous) => retenues.has(terme) && tous.indexOf(terme) === i)
        .slice(0, MAX_RECHERCHEES)
        .map(formaterCompetence)
      return { recherchees, contrat: repererContrat(offre.texteBrut), prerequis: couverture.prerequis }
    },

    async adapterCv(offre: Offre): Promise<CvGenere> {
      const actif = profilActif()
      adaptationEnCours?.abort()
      const annulation = new AbortController()
      adaptationEnCours = annulation
      try {
        signaler({ tache: 'adaptation', cle: 'preparation', etape: 'Préparation du modèle' })
        const [params, llm] = await Promise.all([parametres.lire(), fournisseur()])
        const cle = cleOffre(offre)
        const cv = await llm.adapterCv(actif.profil, offre, {
          reformuler: params.reformulerPuces,
          analyse: analyses.get(cle),
          surAnalyse: (analyse) => memoriser(cle, analyse),
          surEtape: (e) => signaler({ tache: 'adaptation', ...e, calcul: llm.modeCalcul?.() ?? undefined }),
          signal: annulation.signal,
        })
        annulation.signal.throwIfAborted()
        const offreId = enregistrerOffre(bdd, offre)
        return { id: enregistrerCv(bdd, actif.id, offreId, cv), offreId, cv }
      } catch (erreur) {
        if (annulation.signal.aborted) throw new ErreurCodee('annule', 'Création annulée.', { cause: erreur })
        throw erreur
      } finally {
        if (adaptationEnCours === annulation) adaptationEnCours = null
      }
    },

    async annulerAdaptation() {
      adaptationEnCours?.abort()
    },

    async genererAccroche(profil: Profil) {
      signaler({ tache: 'accroche', etape: 'Repérage des compétences transversales' })
      return (await fournisseur()).genererAccroche(profil)
    },

    async htmlModeleCv(cv, modeleId) {
      return genererHtmlCv(construireModele(profilActif().profil, cv), trouverModele(modeleId).id)
    },

    async exporterCv(cv, format, modeleId) {
      const actif = profilActif()
      const params = await parametres.lire()
      const style: IdModele = trouverModele(modeleId ?? params.modeleCv).id
      const modele = construireModele(actif.profil, cv)
      const chemin = await choisirDestination(nomFichierCv(modele, format), format)
      if (chemin === null) return null
      const contenu =
        format === 'pdf' ? await genererPdf(genererHtmlCv(modele, style)) : await genererDocxCv(modele, style)
      try {
        await writeFile(chemin, contenu)
      } catch (erreur) {
        const detail = erreur instanceof Error ? erreur.message : String(erreur)
        throw new ErreurCodee('ecriture-impossible', `Écriture impossible : ${detail}`, { cause: erreur })
      }
      exportes.add(resolve(chemin))
      return chemin
    },

    ouvrirFichier: async (chemin: string) => deps.ouvrirChemin(verifierExporte(chemin)),
    montrerDansDossier: async (chemin: string) => deps.montrerChemin(verifierExporte(chemin)),

    lireParametres: (): Promise<EtatParametres> => parametres.etat(),
    enregistrerParametres: (p: Parametres) => parametres.enregistrer(p),
    definirCleApi: (cle: string) => parametres.definirCle(cle),

    async effacerDonnees() {
      effacerDonnees(bdd)
      analyses.clear()
      await parametres.definirCle('')
    },

    lireEtatMiseAJour: async () => deps.misesAJour.etat(),
    verifierMiseAJour: () => deps.misesAJour.verifier(),
    installerMiseAJour: async () => deps.misesAJour.installer(),

    liberer: () => liberer(courant),

    lireEtatModeles: (): Promise<EtatModeles> => modeles.etat(),
    telechargerModele: (id: string) => modeles.telecharger(id),
    annulerTelechargement: async () => modeles.annuler(),
    supprimerModele: (id: string) => modeles.supprimer(id),
  }
}
