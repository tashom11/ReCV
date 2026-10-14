import { z } from 'zod'

export { CHANNELS, type IpcResult } from './channels'

import { TEMPLATE_IDS } from './export/templates'
import {
  type JobPosting,
  jobPostingSchema,
  type Profile,
  profileSchema,
  type Requirements,
  type TailoredCv,
  tailoredCvSchema,
} from './schemas'
import type { StepKey } from './steps'

export type { ErrorCode } from './errors'

import { LOCAL_HOSTS, parseServiceUrl } from './serviceUrl'

export { isLocalService } from './serviceUrl'

// Contrat IPC partagé entre `src/main` (handlers), `src/preload` (pont) et `src/renderer` (appels).

// Une URL de service est une destination de données personnelles (et de la clé API) : on la valide.
const serviceUrl = z
  .string()
  .max(2048)
  .refine((v) => parseServiceUrl(v) !== null, 'Adresse invalide : une URL http(s) sans identifiants est attendue.')

const safeApiUrl = serviceUrl.refine((v) => {
  const url = parseServiceUrl(v)
  return url !== null && (url.protocol === 'https:' || LOCAL_HOSTS.has(url.hostname))
}, 'L’adresse de l’API doit être en https (http n’est accepté que pour localhost).')

export const settingsSchema = z.object({
  provider: z.enum(['ollama', 'api', 'local']).default('local'),
  ollamaModel: z.string().max(200).default('qwen3:8b'),
  ollamaUrl: serviceUrl.default('http://localhost:11434/v1'),
  apiUrl: safeApiUrl.default('https://api.openai.com/v1'),
  apiModel: z.string().max(200).default(''),
  /** Reformuler les puces avec le modèle (plus lent). Par défaut : sélection des puces, sans modèle. */
  rewriteBullets: z.boolean().default(false),
  /** Modèle de mise en page du CV exporté (voir `core/export/modeles.ts`). */
  cvTemplate: z.enum(TEMPLATE_IDS).default('classique'),
  localModelPath: z
    .string()
    .max(1024)
    .refine((v) => v === '' || v.toLowerCase().endsWith('.gguf'), 'Le modèle local doit être un fichier .gguf.')
    .optional(),
})

/** Origine (schéma + hôte + port) d'une URL de service, pour détecter un changement de destination. */
export function urlOrigin(value: string): string | null {
  return parseServiceUrl(value)?.origin ?? null
}
export type Settings = z.infer<typeof settingsSchema>

export interface SettingsState extends Settings {
  /** La clé elle-même ne quitte jamais le process principal. */
  hasApiKey: boolean
}

export interface SavedProfile {
  id: number
  profile: Profile
  /** Nom du fichier d'origine, connu seulement au moment de l'import. */
  fileName?: string
}

export type ExportFormat = 'pdf' | 'docx'

export interface GeneratedCv {
  id: number
  jobPostingId: number
  cv: TailoredCv
}

/** Ce que l'annonce demande, rapproché du CV : affiché sur la carte de confirmation, avant toute création. */
export interface JobPostingPreview {
  /** Compétences et qualités recherchées par l'employeur (8 au plus), dans l'ordre de l'annonce. */
  soughtSkills: string[]
  /** Type de contrat et temps de travail, s'ils sont écrits dans l'annonce (« CDI · temps plein »). */
  contractType?: string
  requirements: Requirements
}

/** Fichier déposé dans la fenêtre : le preload en retrouve le chemin, le renderer ne le voit jamais. */
export interface DroppedFile {
  readonly name: string
  readonly size: number
}

export interface LocalModelState {
  id: string
  name: string
  description: string
  sizeBytes: number
  path: string
  installed: boolean
  /** Adapté à la mémoire détectée sur cette machine. */
  recommended: boolean
  compatible: boolean
}

export interface ModelDownloadProgress {
  id: string
  receivedBytes: number
  totalBytes: number
  status: 'en-cours' | 'verification' | 'termine' | 'erreur' | 'annule'
  message?: string
}

export interface ModelsState {
  ramGb: number
  vramGb: number
  models: LocalModelState[]
  /** Téléchargement en cours (ou dernier état connu pendant celui-ci). */
  download: ModelDownloadProgress | null
}

/** Où en est la mise à jour de l'application (releases GitHub). */
export interface UpdateState {
  /** Version en cours d'exécution. */
  version: string
  /**
   * `indisponible` : application non installée (développement). `prete` : téléchargée, installée à la fermeture.
   * `erreur` : vérification impossible (hors ligne, dépôt inaccessible).
   */
  status: 'indisponible' | 'inactif' | 'verification' | 'a-jour' | 'telechargement' | 'prete' | 'erreur'
  newVersion?: string
  /** Avancement du téléchargement, de 0 à 100. */
  percent?: number
  /** Message technique de la dernière erreur. */
  message?: string
  /** Horodatage (ms) de la dernière vérification aboutie. */
  checkedAt?: number
}

/** Étape en cours d'une tâche longue (import du CV, analyse d'offre, adaptation) : le renderer l'affiche. */
export interface TaskProgress {
  task: 'import' | 'offre' | 'adaptation' | 'accroche'
  /** Étape stable de l'adaptation (l'interface la traduit en langage courant). */
  key?: StepKey
  /** Libellé lisible, ex. « Réécriture des expériences ». */
  label: string
  current?: number
  total?: number
  /** Où tourne le modèle embarqué : sur le processeur, le calcul est bien plus lent. */
  compute?: 'gpu' | 'cpu'
}

/** Méthodes requête/réponse, implémentées par le service du process principal. */
export interface ApiService {
  /** Ouvre le sélecteur de fichier (PDF/DOCX), extrait le profil et l'enregistre. `null` si annulé. */
  importCv(): Promise<SavedProfile | null>
  /** Même traitement pour un fichier déposé dans la fenêtre, désigné par son chemin. */
  importDroppedCv(path: string): Promise<SavedProfile>
  getProfile(): Promise<SavedProfile | null>
  saveProfile(profile: Profile): Promise<SavedProfile>
  fetchJobPosting(url: string): Promise<JobPosting>
  parseJobPostingText(text: string): Promise<JobPosting>
  /** Analyse l'annonce avec le modèle (résultat mémorisé pour `adapterCv`) et la rapproche du profil enregistré. */
  previewJobPosting(jobPosting: JobPosting): Promise<JobPostingPreview>
  /** Adapte le profil enregistré à l'offre, puis enregistre l'offre et le CV obtenu. */
  tailorCv(jobPosting: JobPosting): Promise<GeneratedCv>
  /** Interrompt l'adaptation en cours : `adapterCv` échoue alors avec le code `annule`. */
  cancelTailoring(): Promise<void>
  getSettings(): Promise<SettingsState>
  saveSettings(settings: Settings): Promise<SettingsState>
  /** Enregistre le CV validé (coordonnées du profil actif) via un sélecteur de fichier. Chemin écrit, ou `null` si annulé. */
  exportCv(cv: TailoredCv, format: ExportFormat, templateId?: string): Promise<string | null>
  /** HTML complet du CV mis en page avec un modèle (photo comprise), à afficher dans un cadre isolé. */
  templateHtml(cv: TailoredCv, templateId: string): Promise<string>
  /** Ouvre un CV exporté pendant cette session (tout autre chemin est refusé). */
  openFile(path: string): Promise<void>
  /** Montre dans l'explorateur un CV exporté pendant cette session (tout autre chemin est refusé). */
  revealInFolder(path: string): Promise<void>
  /** Accroche générique fondée sur les compétences transversales du profil fourni (même non enregistré). */
  generateSummary(profile: Profile): Promise<string>
  /** Chaîne vide : supprime la clé. */
  setApiKey(key: string): Promise<SettingsState>
  getModelsState(): Promise<ModelsState>
  /** Résout quand le fichier est téléchargé, vérifié et sélectionné dans les paramètres. */
  downloadModel(id: string): Promise<void>
  cancelDownload(): Promise<void>
  deleteModel(id: string): Promise<void>
  /** Supprime profil, offres, CV générés et clé API. Les paramètres et modèles sont conservés. */
  eraseData(): Promise<void>
  getUpdateState(): Promise<UpdateState>
  /** Vérifie maintenant ; résout avec l'état obtenu (le téléchargement éventuel continue ensuite). */
  checkForUpdate(): Promise<UpdateState>
  /** Ferme l'application et installe la version déjà téléchargée. */
  installUpdate(): Promise<void>
}

/** API complète vue par le renderer. */
export interface RecvApi extends Omit<ApiService, 'importDroppedCv'> {
  importDroppedCv(fileName: DroppedFile): Promise<SavedProfile>
  /** Retourne la fonction de désabonnement. */
  onModelProgress(callback: (progress: ModelDownloadProgress) => void): () => void
  /** Étapes des tâches longues (adaptation…). Retourne la fonction de désabonnement. */
  onTaskProgress(callback: (progress: TaskProgress) => void): () => void
  /** Changements d'état de la mise à jour. Retourne la fonction de désabonnement. */
  onUpdate(callback: (status: UpdateState) => void): () => void
}

// Bornes de taille : le renderer n'est pas fiable (les schémas métier eux-mêmes ne sont pas bornés,
// car ils valident aussi les sorties du LLM).
const MAX_JSON_SIZE = 500_000
const bounded = <T extends z.ZodType>(schema: T) =>
  schema.refine((v) => JSON.stringify(v).length <= MAX_JSON_SIZE, 'Données trop volumineuses.')

export const ipcInputs = {
  cv: bounded(tailoredCvSchema),
  format: z.enum(['pdf', 'docx']),
  cvTemplateId: z.enum(TEMPLATE_IDS),
  profile: bounded(profileSchema),
  jobPosting: bounded(jobPostingSchema),
  settings: settingsSchema,
  text: z.string().min(1).max(200_000),
  url: z.string().min(1).max(2_048),
  key: z.string().max(1_024),
  templateId: z.string().min(1).max(64),
  path: z.string().min(1).max(1_024),
}
