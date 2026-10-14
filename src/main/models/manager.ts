import { rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelDownloadProgress, ModelsState } from '@core/api'
import { isModelCompatible, LOCAL_MODELS, type LocalModel, type Resources, recommendModel } from '@core/llm'
import { downloadFile } from './download'

export interface ModelManagerDeps {
  /** `<userData>/modeles` */
  folder: string
  resources: () => Promise<Resources>
  emit: (progress: ModelDownloadProgress) => void
  /** Called when a model has just been installed (e.g. to select it in the settings). */
  afterInstall?: (path: string, model: LocalModel) => Promise<void>
  download?: typeof downloadFile
}

const PROGRESS_INTERVAL_MS = 200

export class ModelManager {
  private current: { id: string; cancel: AbortController; latest: ModelDownloadProgress } | null = null

  constructor(private readonly deps: ModelManagerDeps) {}

  private find(id: string): LocalModel {
    const model = LOCAL_MODELS.find((m) => m.id === id)
    if (!model) throw new Error(`Modèle inconnu : ${id}`)
    return model
  }

  modelPath(model: LocalModel): string {
    return join(this.deps.folder, model.fileName)
  }

  private async isInstalled(model: LocalModel): Promise<boolean> {
    try {
      return (await stat(this.modelPath(model))).size === model.sizeBytes
    } catch {
      return false
    }
  }

  async state(): Promise<ModelsState> {
    const resources = await this.deps.resources()
    const recommended = recommendModel(resources)
    const models = await Promise.all(
      LOCAL_MODELS.map(async (m) => ({
        id: m.id,
        level: m.level,
        name: m.name,
        description: m.description,
        sizeBytes: m.sizeBytes,
        path: this.modelPath(m),
        installed: await this.isInstalled(m),
        recommended: m.id === recommended.id,
        compatible: isModelCompatible(m, resources),
      })),
    )
    return { ...resources, models: models, download: this.current?.latest ?? null }
  }

  /** One download at a time. Resolves once the file is verified and in place. */
  async download(id: string): Promise<void> {
    if (this.current) throw new Error('Un téléchargement est déjà en cours.')
    const model = this.find(id)
    const cancel = new AbortController()
    const state = { id, cancel, latest: this.progress(id, 0, model.sizeBytes, 'downloading') }
    this.current = state

    const emit = (p: ModelDownloadProgress) => {
      state.latest = p
      this.deps.emit(p)
    }
    let lastSent = 0

    try {
      emit(state.latest)
      await (this.deps.download ?? downloadFile)({
        url: model.url,
        destination: this.modelPath(model),
        sizeBytes: model.sizeBytes,
        sha256: model.sha256,
        signal: cancel.signal,
        onProgress: (received, total) => {
          const now = Date.now()
          if (now - lastSent < PROGRESS_INTERVAL_MS && received < total) return
          lastSent = now
          // At 100 %, the file is still being hashed then renamed.
          emit(this.progress(id, received, total, received >= total ? 'verifying' : 'downloading'))
        },
      })
      await this.deps.afterInstall?.(this.modelPath(model), model)
      emit(this.progress(id, model.sizeBytes, model.sizeBytes, 'done'))
    } catch (error) {
      if (cancel.signal.aborted) {
        emit({ ...state.latest, status: 'cancelled' })
      } else {
        const message = error instanceof Error ? error.message : String(error)
        emit({ ...state.latest, status: 'error', message })
        throw error
      }
    } finally {
      this.current = null
    }
  }

  /** The partial file is kept: the next download resumes where it stopped. */
  cancel(): void {
    this.current?.cancel.abort()
  }

  async remove(id: string): Promise<void> {
    const model = this.find(id)
    if (this.current?.id === id) throw new Error('Téléchargement en cours : mettez-le d’abord en pause.')
    await rm(this.modelPath(model), { force: true })
    await rm(`${this.modelPath(model)}.part`, { force: true })
  }

  private progress(id: string, receivedBytes: number, totalOctets: number, state: ModelDownloadProgress['status']) {
    return { id, receivedBytes: receivedBytes, totalBytes: totalOctets, status: state } satisfies ModelDownloadProgress
  }
}
