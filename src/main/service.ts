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
import type { AppDatabase } from './db/connection'
import {
  createProfile,
  eraseData,
  getActiveProfile,
  purgeOldData,
  saveJobPosting,
  saveProfile,
  saveTailoredCv,
} from './db/repositories'
import type { ModelManager } from './models/manager'
import type { SettingsStore } from './settingsStore'
import type { Updater } from './updater'

export interface ServiceDeps {
  db: AppDatabase
  settings: SettingsStore
  /** Opens the file picker and returns the text extracted from the CV and the file name, or `null` if cancelled. */
  pickAndReadCv: () => Promise<{ text: string; name: string } | null>
  /** Text extracted from a CV given by its path (file dropped on the window). */
  readCv: (path: string) => Promise<string>
  /** Browser rendering fallback for job postings built in JS. */
  renderHtml: (url: string) => Promise<string>
  /** Browser User-Agent used to fetch job postings. */
  userAgent?: string
  models: ModelManager
  updater: Pick<Updater, 'state' | 'check' | 'install'>
  /** Reports the current step of a long task to the renderer. */
  emitTask?: (progress: TaskProgress) => void
  /** Save picker: chosen path, or `null` if cancelled. */
  chooseDestination: (defaultName: string, extension: 'pdf' | 'docx') => Promise<string | null>
  /** Renders the HTML to PDF (hidden window on the Electron side). */
  generatePdf: (html: string) => Promise<Buffer>
  /** Opens a file with the system default application. */
  openPath: (path: string) => Promise<void>
  /** Shows a file in the file explorer. */
  revealPath: (path: string) => void
  /** Overridable for tests (never a real LLM call). */
  createProvider?: (settings: Settings, apiKey: string | null) => Promise<LlmProvider>
}

const MAX_SOUGHT_SKILLS = 8
// Data minimisation: older tailored CVs (and their job postings) are deleted.
const KEPT_CREATIONS = 20

async function defaultProvider(settings: Settings, apiKey: string | null): Promise<LlmProvider> {
  switch (settings.provider) {
    case 'ollama':
      return createOllamaProvider({ model: settings.ollamaModel, baseUrl: settings.ollamaUrl })
    case 'api':
      if (!apiKey) throw new Error('Aucune clé personnelle enregistrée : renseignez-la dans les réglages.')
      if (!settings.apiModel) throw new Error('Aucun modèle indiqué pour le service en ligne.')
      return createApiProvider({ baseUrl: settings.apiUrl, apiKey: apiKey, model: settings.apiModel })
    case 'local': {
      if (!settings.localModelPath) throw new CodedError('engine-missing', 'Aucun modèle local sélectionné.')
      const { createLocalProvider } = await import('@core/llm/localEngine')
      return createLocalProvider({ modelPath: settings.localModelPath })
    }
  }
}

/** Logic of the IPC handlers, without direct dependency on Electron (testable). */
export function createService(deps: ServiceDeps): ApiService & { release(): Promise<void> } {
  const { db, settings, models, pickAndReadCv, renderHtml, chooseDestination, generatePdf } = deps
  const create = deps.createProvider ?? defaultProvider
  const report = (progress: TaskProgress) => deps.emitTask?.(progress)
  const analyses = new Map<string, JobAnalysis>()
  // Only files written by this session's export can be opened: the renderer does not choose the path.
  const exported = new Set<string>()
  let runningTailoring: AbortController | null = null

  // A single live provider, reused as long as the settings (and the key) do not change: the local model weighs several
  // GB and must be loaded only once, then released.
  let current: { fingerprint: string; promise: Promise<LlmProvider> } | null = null

  const release = async (entry: typeof current) => {
    const previous = await entry?.promise.catch(() => null)
    await previous?.release?.()
  }

  const provider = async (): Promise<LlmProvider> => {
    const [params, apiKey] = await Promise.all([settings.read(), settings.readKey()])
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([params, apiKey]))
      .digest('hex')
    if (current?.fingerprint !== fingerprint) {
      const previous = current
      current = null
      await release(previous)
      const promise = create(params, apiKey)
      const entry = { fingerprint, promise }
      current = entry
      // A failed creation does not stay cached: the next call retries.
      promise.catch(() => {
        if (current === entry) current = null
      })
    }
    if (!current) throw new Error('Fournisseur indisponible')
    return current.promise
  }

  const activeProfile = () => {
    const active = getActiveProfile(db)
    if (!active) throw new CodedError('profile-missing', 'Aucun CV enregistré : importez d’abord votre CV.')
    return active
  }

  const importCvText = async (text: string, fileName: string): Promise<SavedProfile> => {
    report({ task: 'import' })
    const extracted = await (await provider()).extractProfile(text)
    // The photo is chosen by the user, not extracted from the CV: it follows the active profile.
    const photo = getActiveProfile(db)?.profile.photo
    const created = createProfile(db, photo ? { ...extracted, photo } : extracted)
    purgeOldData(db, { keepCreations: KEPT_CREATIONS })
    return { ...created, fileName: fileName }
  }

  // The analysis of a job posting does not depend on the profile: kept, it serves the job posting confirmation card and
  // then the tailoring, without a second model call.
  const jobPostingKey = (jobPosting: JobPosting) =>
    createHash('sha256').update(`${jobPosting.jobTitle}\n${jobPosting.rawText}`).digest('hex')
  const remember = (key: string, analysis: JobAnalysis) => {
    analyses.set(key, analysis)
    if (analyses.size > 20) analyses.delete(analyses.keys().next().value as string)
  }

  const checkExported = (path: string): string => {
    const absolute = resolve(path)
    if (!exported.has(absolute)) throw new Error('Ce fichier n’a pas été créé par Re:CV pendant cette session.')
    return absolute
  }

  return {
    async importCv(): Promise<SavedProfile | null> {
      const chosen = await pickAndReadCv()
      return chosen === null ? null : importCvText(chosen.text, chosen.name)
    },

    async importDroppedCv(path: string): Promise<SavedProfile> {
      return importCvText(await deps.readCv(path), basename(path))
    },

    async getProfile() {
      return getActiveProfile(db)
    },

    async saveProfile(profile: Profile) {
      return saveProfile(db, profile)
    },

    fetchJobPosting: (url: string) => fetchJobPosting(url, { renderHtml: renderHtml, userAgent: deps.userAgent }),

    async parseJobPostingText(text: string): Promise<JobPosting> {
      report({ task: 'job-posting' })
      return (await provider()).extractJobPosting(text)
    },

    async previewJobPosting(jobPosting: JobPosting): Promise<JobPostingPreview> {
      const active = activeProfile()
      const key = jobPostingKey(jobPosting)
      let analysis = analyses.get(key)
      if (!analysis) {
        report({ task: 'job-posting' })
        analysis = await (await provider()).analyzeJobPosting(jobPosting)
        remember(key, analysis)
      }
      const coverage = analyzeCoverage(prepareProfile(active.profile), analysis)
      // Job posting order (know-how, qualities, other terms), limited to what the coverage kept.
      const kept = new Set([...coverage.evidenced, ...coverage.missing])
      const recherchees = [...analysis.requiredSkills, ...analysis.softSkills, ...analysis.keywords]
        .map((term) => term.trim())
        .filter((term, i, all) => kept.has(term) && all.indexOf(term) === i)
        .slice(0, MAX_SOUGHT_SKILLS)
        .map(formatSkill)
      return {
        soughtSkills: recherchees,
        contractType: detectContractType(jobPosting.rawText),
        requirements: coverage.requirements,
      }
    },

    async tailorCv(jobPosting: JobPosting): Promise<GeneratedCv> {
      const active = activeProfile()
      runningTailoring?.abort()
      const cancellation = new AbortController()
      runningTailoring = cancellation
      try {
        report({ task: 'tailoring', key: 'setup' })
        const [params, llm] = await Promise.all([settings.read(), provider()])
        const key = jobPostingKey(jobPosting)
        const cv = await llm.tailorCv(active.profile, jobPosting, {
          rewrite: params.rewriteBullets,
          analysis: analyses.get(key),
          onAnalysis: (analysis) => remember(key, analysis),
          onStep: (e) => report({ task: 'tailoring', ...e, compute: llm.computeMode?.() ?? undefined }),
          signal: cancellation.signal,
        })
        cancellation.signal.throwIfAborted()
        const jobPostingId = saveJobPosting(db, jobPosting)
        const id = saveTailoredCv(db, active.id, jobPostingId, cv)
        purgeOldData(db, { keepCreations: KEPT_CREATIONS })
        return { id, jobPostingId: jobPostingId, cv }
      } catch (error) {
        if (cancellation.signal.aborted) throw new CodedError('cancelled', 'Création annulée.', { cause: error })
        throw error
      } finally {
        if (runningTailoring === cancellation) runningTailoring = null
      }
    },

    async cancelTailoring() {
      runningTailoring?.abort()
    },

    async generateSummary(profile: Profile) {
      report({ task: 'summary' })
      return (await provider()).generateSummary(profile)
    },

    async templateHtml(cv, templateId) {
      return generateHtmlCv(buildCvDocument(activeProfile().profile, cv), findTemplate(templateId).id)
    },

    async exportCv(cv, format, templateId) {
      const active = activeProfile()
      const params = await settings.read()
      const style: TemplateId = findTemplate(templateId ?? params.cvTemplate).id
      const model = buildCvDocument(active.profile, cv)
      const path = await chooseDestination(cvFileName(model, format), format)
      if (path === null) return null
      const content =
        format === 'pdf' ? await generatePdf(generateHtmlCv(model, style)) : await generateDocxCv(model, style)
      try {
        await writeFile(path, content)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new CodedError('write-failed', `Écriture impossible : ${detail}`, { cause: error })
      }
      exported.add(resolve(path))
      return path
    },

    openFile: async (path: string) => deps.openPath(checkExported(path)),
    revealInFolder: async (path: string) => deps.revealPath(checkExported(path)),

    getSettings: (): Promise<SettingsState> => settings.state(),
    saveSettings: (p: Settings) => settings.save(p),
    setApiKey: (key: string) => settings.setKey(key),

    async eraseData() {
      eraseData(db)
      analyses.clear()
      await settings.setKey('')
    },

    getUpdateState: async () => deps.updater.state(),
    checkForUpdate: () => deps.updater.check(),
    installUpdate: async () => deps.updater.install(),

    release: () => release(current),

    getModelsState: (): Promise<ModelsState> => models.state(),
    downloadModel: (id: string) => models.download(id),
    cancelDownload: async () => models.cancel(),
    deleteModel: (id: string) => models.remove(id),
  }
}
