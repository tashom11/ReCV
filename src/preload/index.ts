import type { ModelDownloadProgress, RecvApi, TaskProgress, UpdateState } from '@core/api'
import { CHANNELS, encodeError, type IpcResult } from '@core/channels'
import { contextBridge, type IpcRendererEvent, ipcRenderer, webUtils } from 'electron'

// Typed API exposed to the renderer: only these methods, never ipcRenderer itself.
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) throw new Error(encodeError(result.message, result.code))
  return result.value
}

const api: RecvApi = {
  importCv: () => invoke(CHANNELS.importCv),
  // The path of a dropped file can only be read here: the renderer only passes the File object.
  importDroppedCv: (file) => invoke(CHANNELS.importDroppedCv, webUtils.getPathForFile(file as File)),
  getProfile: () => invoke(CHANNELS.getProfile),
  saveProfile: (profile) => invoke(CHANNELS.saveProfile, profile),
  fetchJobPosting: (url) => invoke(CHANNELS.fetchJobPosting, url),
  parseJobPostingText: (text) => invoke(CHANNELS.parseJobPostingText, text),
  previewJobPosting: (jobPosting) => invoke(CHANNELS.previewJobPosting, jobPosting),
  tailorCv: (jobPosting) => invoke(CHANNELS.tailorCv, jobPosting),
  cancelTailoring: () => invoke(CHANNELS.cancelTailoring),
  openFile: (path) => invoke(CHANNELS.openFile, path),
  revealInFolder: (path) => invoke(CHANNELS.revealInFolder, path),
  getSettings: () => invoke(CHANNELS.getSettings),
  saveSettings: (settings) => invoke(CHANNELS.saveSettings, settings),
  setApiKey: (key) => invoke(CHANNELS.setApiKey, key),
  exportCv: (cv, format, templateId) => invoke(CHANNELS.exportCv, cv, format, templateId),
  templateHtml: (cv, templateId) => invoke(CHANNELS.templateHtml, cv, templateId),
  generateSummary: (profile) => invoke(CHANNELS.generateSummary, profile),
  getModelsState: () => invoke(CHANNELS.getModelsState),
  downloadModel: (id) => invoke(CHANNELS.downloadModel, id),
  cancelDownload: () => invoke(CHANNELS.cancelDownload),
  deleteModel: (id) => invoke(CHANNELS.deleteModel, id),
  eraseData: () => invoke(CHANNELS.eraseData),
  getUpdateState: () => invoke(CHANNELS.getUpdateState),
  checkForUpdate: () => invoke(CHANNELS.checkForUpdate),
  installUpdate: () => invoke(CHANNELS.installUpdate),
  onUpdate: (rappel) => {
    const listener = (_e: IpcRendererEvent, state: UpdateState) => rappel(state)
    ipcRenderer.on(CHANNELS.updateStatus, listener)
    return () => ipcRenderer.removeListener(CHANNELS.updateStatus, listener)
  },
  onTaskProgress: (rappel) => {
    const listener = (_e: IpcRendererEvent, progress: TaskProgress) => rappel(progress)
    ipcRenderer.on(CHANNELS.taskProgress, listener)
    return () => ipcRenderer.removeListener(CHANNELS.taskProgress, listener)
  },
  onModelProgress: (rappel) => {
    const listener = (_e: IpcRendererEvent, progress: ModelDownloadProgress) => rappel(progress)
    ipcRenderer.on(CHANNELS.modelProgress, listener)
    return () => ipcRenderer.removeListener(CHANNELS.modelProgress, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
