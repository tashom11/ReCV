import { type ApiService, CHANNELS, type IpcResult, ipcInputs } from '@core/api'
import { CodedError } from '@core/errors'
import { JobPostingFetchError } from '@core/job-posting'
import type { IpcMain } from 'electron'
import type { ZodType } from 'zod'

function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error('Invalid data received by the main process.')
  return result.data
}

function envelope(error: unknown): { ok: false; message: string; code?: string } {
  if (error instanceof JobPostingFetchError || error instanceof CodedError)
    return { ok: false, message: error.message, code: error.code }
  return { ok: false, message: error instanceof Error ? error.message : String(error) }
}

/**
 * Wires the API to ipcMain. Every renderer input is validated again by Zod: the renderer is never trusted.
 */
export function registerHandlers(
  ipcMain: IpcMain,
  api: ApiService,
  /** Receives the URL of the calling frame; refuses anything that is not the application interface. */
  isAllowedSender: (url: string) => boolean = () => true,
  /** Receives every failed call (except a cancellation asked by the user), for the diagnostic log. */
  onError: (channel: string, error: unknown) => void = () => undefined,
): void {
  const handle = (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
    ipcMain.handle(channel, async (event, ...args): Promise<IpcResult<unknown>> => {
      try {
        if (!isAllowedSender(event.senderFrame?.url ?? '')) throw new Error('IPC call refused.')
        return { ok: true, value: await handler(...args) }
      } catch (error) {
        const result = envelope(error)
        if (result.code !== 'cancelled') onError(channel, error)
        return result
      }
    })
  }

  handle(CHANNELS.importCv, () => api.importCv())
  handle(CHANNELS.importDroppedCv, (path) => api.importDroppedCv(parseInput(ipcInputs.path, path)))
  handle(CHANNELS.getProfile, () => api.getProfile())
  handle(CHANNELS.saveProfile, (profile) => api.saveProfile(parseInput(ipcInputs.profile, profile)))
  handle(CHANNELS.fetchJobPosting, (url) => api.fetchJobPosting(parseInput(ipcInputs.url, url)))
  handle(CHANNELS.parseJobPostingText, (text) => api.parseJobPostingText(parseInput(ipcInputs.text, text)))
  handle(CHANNELS.previewJobPosting, (jobPosting) =>
    api.previewJobPosting(parseInput(ipcInputs.jobPosting, jobPosting)),
  )
  handle(CHANNELS.tailorCv, (jobPosting) => api.tailorCv(parseInput(ipcInputs.jobPosting, jobPosting)))
  handle(CHANNELS.cancelTailoring, () => api.cancelTailoring())
  handle(CHANNELS.openFile, (path) => api.openFile(parseInput(ipcInputs.path, path)))
  handle(CHANNELS.revealInFolder, (path) => api.revealInFolder(parseInput(ipcInputs.path, path)))
  handle(CHANNELS.getSettings, () => api.getSettings())
  handle(CHANNELS.saveSettings, (p) => api.saveSettings(parseInput(ipcInputs.settings, p)))
  handle(CHANNELS.generateSummary, (profile) => api.generateSummary(parseInput(ipcInputs.profile, profile)))
  handle(CHANNELS.exportCv, (cv, format, model) =>
    api.exportCv(
      parseInput(ipcInputs.cv, cv),
      parseInput(ipcInputs.format, format),
      model === undefined ? undefined : parseInput(ipcInputs.cvTemplateId, model),
    ),
  )
  handle(CHANNELS.templateHtml, (cv, model) =>
    api.templateHtml(parseInput(ipcInputs.cv, cv), parseInput(ipcInputs.cvTemplateId, model)),
  )
  handle(CHANNELS.getModelsState, () => api.getModelsState())
  handle(CHANNELS.downloadModel, (id) => api.downloadModel(parseInput(ipcInputs.templateId, id)))
  handle(CHANNELS.cancelDownload, () => api.cancelDownload())
  handle(CHANNELS.deleteModel, (id) => api.deleteModel(parseInput(ipcInputs.templateId, id)))
  handle(CHANNELS.eraseData, () => api.eraseData())
  handle(CHANNELS.getUpdateState, () => api.getUpdateState())
  handle(CHANNELS.checkForUpdate, () => api.checkForUpdate())
  handle(CHANNELS.installUpdate, () => api.installUpdate())
  handle(CHANNELS.copyDiagnosticReport, () => api.copyDiagnosticReport())
  handle(CHANNELS.setApiKey, (key) => api.setApiKey(parseInput(ipcInputs.key, key)))
}
