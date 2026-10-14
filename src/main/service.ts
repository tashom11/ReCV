import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type {
  ApiService,
  GeneratedCv,
  JobPostingPreview,
  ModelsState,
  SavedProfile,
  Settings,
  SettingsState,
  TaskProgress,
} from '@core/api'
import { CodedError } from '@core/errors'
import {
  buildCvDocument,
  cvFileName,
  findTemplate,
  generateDocxCv,
  generateHtmlCv,
  type TemplateId,
} from '@core/export'
import { detectContractType, fetchJobPosting } from '@core/job-posting'
import { createApiProvider, createOllamaProvider, type LlmProvider } from '@core/llm'
import type { JobPosting, Profile } from '@core/schemas'
import { analyzeCoverage, type JobAnalysis, prepareProfile } from '@core/tailoring'
import { formatSkill } from '@core/tailoring/skills'
import type { Bdd } from './bdd/connexion'
import {
  creerProfil,
  effacerDonnees,
  enregistrerCv,
  enregistrerOffre,
  enregistrerProfil,
  obtenirProfilActif,
  purgeOldData,
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
  emettreTache?: (progression: TaskProgress) => void
  /** Sélecteur d'enregistrement : chemin choisi, ou `null` si annulé. */
  choisirDestination: (nomParDefaut: string, extension: 'pdf' | 'docx') => Promise<string | null>
  /** Rend le HTML en PDF (fenêtre cachée côté Electron). */
  genererPdf: (html: string) => Promise<Buffer>
  /** Ouvre un fichier avec l'application par défaut du système. */
  ouvrirChemin: (chemin: string) => Promise<void>
  /** Montre un fichier dans l'explorateur. */
  montrerChemin: (chemin: string) => void
  /** Surchargeable pour les tests (jamais d'appel LLM réel). */
  creerFournisseur?: (parametres: Settings, cleApi: string | null) => Promise<LlmProvider>
}

const MAX_RECHERCHEES = 8
// Data minimisation: older tailored CVs (and their job postings) are deleted.
const CREATIONS_CONSERVEES = 20

async function fournisseurParDefaut(parametres: Settings, cleApi: string | null): Promise<LlmProvider> {
  switch (parametres.provider) {
    case 'ollama':
      return createOllamaProvider({ model: parametres.ollamaModel, baseUrl: parametres.ollamaUrl })
    case 'api':
      if (!cleApi) throw new Error('Aucune clé personnelle enregistrée : renseignez-la dans les réglages.')
      if (!parametres.apiModel) throw new Error('Aucun modèle indiqué pour le service en ligne.')
      return createApiProvider({ baseUrl: parametres.apiUrl, apiKey: cleApi, model: parametres.apiModel })
    case 'local': {
      if (!parametres.localModelPath) throw new CodedError('moteur-absent', 'Aucun modèle local sélectionné.')
      const { createLocalProvider: creerFournisseurLocal } = await import('@core/llm/localEngine')
      return creerFournisseurLocal({ modelPath: parametres.localModelPath })
    }
  }
}

/** Logique des handlers IPC, sans dépendance directe à Electron (testable). */
export function creerService(deps: DependancesService): ApiService & { liberer(): Promise<void> } {
  const { bdd, parametres, modeles, choisirEtLireCv, rendreHtml, choisirDestination, genererPdf } = deps
  const creer = deps.creerFournisseur ?? fournisseurParDefaut
  const signaler = (progression: TaskProgress) => deps.emettreTache?.(progression)
  const analyses = new Map<string, JobAnalysis>()
  // Seuls les fichiers écrits par l'export de cette session peuvent être ouverts : le renderer ne choisit pas le chemin.
  const exportes = new Set<string>()
  let adaptationEnCours: AbortController | null = null

  // Un seul fournisseur vivant, réutilisé tant que les paramètres (et la clé) ne changent pas :
  // le modèle local pèse plusieurs Go et ne doit être chargé qu'une fois, puis libéré.
  let courant: { empreinte: string; promesse: Promise<LlmProvider> } | null = null

  const liberer = async (entree: typeof courant) => {
    const ancien = await entree?.promesse.catch(() => null)
    await ancien?.release?.()
  }

  const fournisseur = async (): Promise<LlmProvider> => {
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
    if (!actif) throw new CodedError('profil-absent', 'Aucun CV enregistré : importez d’abord votre CV.')
    return actif
  }

  const importer = async (texte: string, nomFichier: string): Promise<SavedProfile> => {
    signaler({ task: 'import', label: 'Analyse du CV par le modèle' })
    const extrait = await (await fournisseur()).extractProfile(texte)
    // La photo est choisie par l'utilisateur, pas extraite du CV : elle suit le profil actif.
    const photo = obtenirProfilActif(bdd)?.profile.photo
    const cree = creerProfil(bdd, photo ? { ...extrait, photo } : extrait)
    purgeOldData(bdd, { keepCreations: CREATIONS_CONSERVEES })
    return { ...cree, fileName: nomFichier }
  }

  // L'analyse d'une offre ne dépend pas du profil : mémorisée, elle sert à la carte de confirmation de l'annonce
  // puis à l'adaptation, sans second appel au modèle.
  const cleOffre = (offre: JobPosting) =>
    createHash('sha256').update(`${offre.jobTitle}\n${offre.rawText}`).digest('hex')
  const memoriser = (cle: string, analyse: JobAnalysis) => {
    analyses.set(cle, analyse)
    if (analyses.size > 20) analyses.delete(analyses.keys().next().value as string)
  }

  const verifierExporte = (chemin: string): string => {
    const absolu = resolve(chemin)
    if (!exportes.has(absolu)) throw new Error('Ce fichier n’a pas été créé par Re:CV pendant cette session.')
    return absolu
  }

  return {
    async importCv(): Promise<SavedProfile | null> {
      const choisi = await choisirEtLireCv()
      return choisi === null ? null : importer(choisi.texte, choisi.nom)
    },

    async importDroppedCv(chemin: string): Promise<SavedProfile> {
      return importer(await deps.lireCv(chemin), basename(chemin))
    },

    async getProfile() {
      return obtenirProfilActif(bdd)
    },

    async saveProfile(profil: Profile) {
      return enregistrerProfil(bdd, profil)
    },

    fetchJobPosting: (url: string) => fetchJobPosting(url, { renderHtml: rendreHtml, userAgent: deps.userAgent }),

    async parseJobPostingText(texte: string): Promise<JobPosting> {
      signaler({ task: 'offre', label: 'Analyse de l’offre par le modèle' })
      return (await fournisseur()).extractJobPosting(texte)
    },

    async previewJobPosting(offre: JobPosting): Promise<JobPostingPreview> {
      const actif = profilActif()
      const cle = cleOffre(offre)
      let analyse = analyses.get(cle)
      if (!analyse) {
        signaler({ task: 'offre', label: 'Repérage de ce que l’employeur recherche' })
        analyse = await (await fournisseur()).analyzeJobPosting(offre)
        memoriser(cle, analyse)
      }
      const couverture = analyzeCoverage(prepareProfile(actif.profile), analyse)
      // Ordre de l'annonce (savoir-faire, qualités, autres termes), limité à ce que la couverture a retenu.
      const retenues = new Set([...couverture.evidenced, ...couverture.missing])
      const recherchees = [...analyse.requiredSkills, ...analyse.softSkills, ...analyse.keywords]
        .map((terme) => terme.trim())
        .filter((terme, i, tous) => retenues.has(terme) && tous.indexOf(terme) === i)
        .slice(0, MAX_RECHERCHEES)
        .map(formatSkill)
      return {
        soughtSkills: recherchees,
        contractType: detectContractType(offre.rawText),
        requirements: couverture.requirements,
      }
    },

    async tailorCv(offre: JobPosting): Promise<GeneratedCv> {
      const actif = profilActif()
      adaptationEnCours?.abort()
      const annulation = new AbortController()
      adaptationEnCours = annulation
      try {
        signaler({ task: 'adaptation', key: 'preparation', label: 'Préparation du modèle' })
        const [params, llm] = await Promise.all([parametres.lire(), fournisseur()])
        const cle = cleOffre(offre)
        const cv = await llm.tailorCv(actif.profile, offre, {
          rewrite: params.rewriteBullets,
          analysis: analyses.get(cle),
          onAnalysis: (analyse) => memoriser(cle, analyse),
          onStep: (e) => signaler({ task: 'adaptation', ...e, compute: llm.computeMode?.() ?? undefined }),
          signal: annulation.signal,
        })
        annulation.signal.throwIfAborted()
        const offreId = enregistrerOffre(bdd, offre)
        const id = enregistrerCv(bdd, actif.id, offreId, cv)
        purgeOldData(bdd, { keepCreations: CREATIONS_CONSERVEES })
        return { id, jobPostingId: offreId, cv }
      } catch (erreur) {
        if (annulation.signal.aborted) throw new CodedError('annule', 'Création annulée.', { cause: erreur })
        throw erreur
      } finally {
        if (adaptationEnCours === annulation) adaptationEnCours = null
      }
    },

    async cancelTailoring() {
      adaptationEnCours?.abort()
    },

    async generateSummary(profil: Profile) {
      signaler({ task: 'accroche', label: 'Repérage des compétences transversales' })
      return (await fournisseur()).generateSummary(profil)
    },

    async templateHtml(cv, modeleId) {
      return generateHtmlCv(buildCvDocument(profilActif().profile, cv), findTemplate(modeleId).id)
    },

    async exportCv(cv, format, modeleId) {
      const actif = profilActif()
      const params = await parametres.lire()
      const style: TemplateId = findTemplate(modeleId ?? params.cvTemplate).id
      const modele = buildCvDocument(actif.profile, cv)
      const chemin = await choisirDestination(cvFileName(modele, format), format)
      if (chemin === null) return null
      const contenu =
        format === 'pdf' ? await genererPdf(generateHtmlCv(modele, style)) : await generateDocxCv(modele, style)
      try {
        await writeFile(chemin, contenu)
      } catch (erreur) {
        const detail = erreur instanceof Error ? erreur.message : String(erreur)
        throw new CodedError('ecriture-impossible', `Écriture impossible : ${detail}`, { cause: erreur })
      }
      exportes.add(resolve(chemin))
      return chemin
    },

    openFile: async (chemin: string) => deps.ouvrirChemin(verifierExporte(chemin)),
    revealInFolder: async (chemin: string) => deps.montrerChemin(verifierExporte(chemin)),

    getSettings: (): Promise<SettingsState> => parametres.etat(),
    saveSettings: (p: Settings) => parametres.enregistrer(p),
    setApiKey: (cle: string) => parametres.definirCle(cle),

    async eraseData() {
      effacerDonnees(bdd)
      analyses.clear()
      await parametres.definirCle('')
    },

    getUpdateState: async () => deps.misesAJour.etat(),
    checkForUpdate: () => deps.misesAJour.verifier(),
    installUpdate: async () => deps.misesAJour.installer(),

    liberer: () => liberer(courant),

    getModelsState: (): Promise<ModelsState> => modeles.etat(),
    downloadModel: (id: string) => modeles.telecharger(id),
    cancelDownload: async () => modeles.annuler(),
    deleteModel: (id: string) => modeles.supprimer(id),
  }
}
