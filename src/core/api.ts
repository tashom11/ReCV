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

// IPC contract shared by `src/main` (handlers), `src/preload` (bridge) and `src/renderer` (calls).

// A service URL is where personal data (and the API key) go: it is validated.
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
  /** Rewrite the bullets with the model (slower). Default: bullets are selected, without the model. */
  rewriteBullets: z.boolean().default(false),
  /** Layout template of the exported CV (see `core/export/templates.ts`). */
  cvTemplate: z.enum(TEMPLATE_IDS).default('classique'),
  localModelPath: z
    .string()
    .max(1024)
    .refine((v) => v === '' || v.toLowerCase().endsWith('.gguf'), 'Le modèle local doit être un fichier .gguf.')
    .optional(),
})

/** Origin (scheme + host + port) of a service URL, to detect a change of destination. */
export function urlOrigin(value: string): string | null {
  return parseServiceUrl(value)?.origin ?? null
}
export type Settings = z.infer<typeof settingsSchema>

export interface SettingsState extends Settings {
  /** The key itself never leaves the main process. */
  hasApiKey: boolean
}

export interface SavedProfile {
  id: number
  profile: Profile
  /** Name of the original file, only known at import time. */
  fileName?: string
}

export type ExportFormat = 'pdf' | 'docx'

export interface GeneratedCv {
  id: number
  jobPostingId: number
  cv: TailoredCv
}

/** What the job posting asks for, compared with the CV: shown on the confirmation card, before any creation. */
export interface JobPostingPreview {
  /** Skills and qualities the employer is looking for (8 at most), in the order of the posting. */
  soughtSkills: string[]
  /** Contract type and working time, when the posting states them (« CDI · temps plein »). */
  contractType?: string
  requirements: Requirements
}

/** File dropped on the window: the preload finds its path, the renderer never sees it. */
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
  /** Suited to the memory detected on this computer. */
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
  /** Download in progress (or last known state during it). */
  download: ModelDownloadProgress | null
}

/** Where the application update stands (GitHub releases). */
export interface UpdateState {
  /** Running version. */
  version: string
  /**
   * `indisponible`: application not installed (development). `prete`: downloaded, installed on quit.
   * `erreur`: check impossible (offline, repository unreachable).
   */
  status: 'indisponible' | 'inactif' | 'verification' | 'a-jour' | 'telechargement' | 'prete' | 'erreur'
  newVersion?: string
  /** Download progress, from 0 to 100. */
  percent?: number
  /** Technical message of the last error. */
  message?: string
  /** Timestamp (ms) of the last successful check. */
  checkedAt?: number
}

/** Current step of a long task (CV import, job posting analysis, tailoring): the renderer shows it. */
export interface TaskProgress {
  task: 'import' | 'offre' | 'adaptation' | 'accroche'
  /** Stable tailoring step (the interface turns it into plain words). */
  key?: StepKey
  /** Readable label, e.g. « Réécriture des expériences ». */
  label: string
  current?: number
  total?: number
  /** Where the local model runs: on the processor, computing is much slower. */
  compute?: 'gpu' | 'cpu'
}

/** Request/response methods, implemented by the main process service. */
export interface ApiService {
  /** Opens the file picker (PDF/DOCX), extracts the profile and saves it. `null` if cancelled. */
  importCv(): Promise<SavedProfile | null>
  /** Same processing for a file dropped on the window, given by its path. */
  importDroppedCv(path: string): Promise<SavedProfile>
  getProfile(): Promise<SavedProfile | null>
  saveProfile(profile: Profile): Promise<SavedProfile>
  fetchJobPosting(url: string): Promise<JobPosting>
  parseJobPostingText(text: string): Promise<JobPosting>
  /** Analyses the job posting with the model (result kept for `tailorCv`) and compares it with the saved profile. */
  previewJobPosting(jobPosting: JobPosting): Promise<JobPostingPreview>
  /** Tailors the saved profile to the job posting, then saves the posting and the resulting CV. */
  tailorCv(jobPosting: JobPosting): Promise<GeneratedCv>
  /** Stops the tailoring in progress: `tailorCv` then fails with the `annule` code. */
  cancelTailoring(): Promise<void>
  getSettings(): Promise<SettingsState>
  saveSettings(settings: Settings): Promise<SettingsState>
  /**
   * Saves the approved CV (contact details of the active profile)
   * through a file picker. Written path, or `null` if cancelled.
   */
  exportCv(cv: TailoredCv, format: ExportFormat, templateId?: string): Promise<string | null>
  /** Complete HTML of the CV laid out with a template (photo included), to show in an isolated frame. */
  templateHtml(cv: TailoredCv, templateId: string): Promise<string>
  /** Opens a CV exported during this session (any other path is refused). */
  openFile(path: string): Promise<void>
  /** Shows in the file explorer a CV exported during this session (any other path is refused). */
  revealInFolder(path: string): Promise<void>
  /** Generic summary based on the transferable skills of the given profile (even if not saved). */
  generateSummary(profile: Profile): Promise<string>
  /** Empty string: deletes the key. */
  setApiKey(key: string): Promise<SettingsState>
  getModelsState(): Promise<ModelsState>
  /** Resolves once the file is downloaded, verified and selected in the settings. */
  downloadModel(id: string): Promise<void>
  cancelDownload(): Promise<void>
  deleteModel(id: string): Promise<void>
  /** Deletes profile, job postings, generated CVs and API key. Settings and models are kept. */
  eraseData(): Promise<void>
  getUpdateState(): Promise<UpdateState>
  /** Checks now; resolves with the resulting state (a download, if any, then goes on). */
  checkForUpdate(): Promise<UpdateState>
  /** Quits the application and installs the version already downloaded. */
  installUpdate(): Promise<void>
}

/** Complete API as seen by the renderer. */
export interface RecvApi extends Omit<ApiService, 'importDroppedCv'> {
  importDroppedCv(fileName: DroppedFile): Promise<SavedProfile>
  /** Returns the unsubscribe function. */
  onModelProgress(callback: (progress: ModelDownloadProgress) => void): () => void
  /** Steps of long tasks (tailoring…). Returns the unsubscribe function. */
  onTaskProgress(callback: (progress: TaskProgress) => void): () => void
  /** Update state changes. Returns the unsubscribe function. */
  onUpdate(callback: (status: UpdateState) => void): () => void
}

// Size limits: the renderer is not trusted (the business schemas themselves are not bounded, since they also
// validate the LLM outputs).
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
