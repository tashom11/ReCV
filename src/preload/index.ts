import type { ModelDownloadProgress, RecvApi, TaskProgress, UpdateState } from '@core/api'
import { CHANNELS, encodeError, type IpcResult } from '@core/channels'
import { contextBridge, type IpcRendererEvent, ipcRenderer, webUtils } from 'electron'

// API typée exposée au renderer : uniquement ces méthodes, jamais ipcRenderer lui-même.
async function appeler<T>(canal: string, ...args: unknown[]): Promise<T> {
  const resultat = (await ipcRenderer.invoke(canal, ...args)) as IpcResult<T>
  if (!resultat.ok) throw new Error(encodeError(resultat.message, resultat.code))
  return resultat.value
}

const api: RecvApi = {
  importCv: () => appeler(CHANNELS.importCv),
  // Le chemin d'un fichier déposé n'est lisible qu'ici : le renderer ne transmet que l'objet File.
  importDroppedCv: (fichier) => appeler(CHANNELS.importDroppedCv, webUtils.getPathForFile(fichier as File)),
  getProfile: () => appeler(CHANNELS.getProfile),
  saveProfile: (profil) => appeler(CHANNELS.saveProfile, profil),
  fetchJobPosting: (url) => appeler(CHANNELS.fetchJobPosting, url),
  parseJobPostingText: (texte) => appeler(CHANNELS.parseJobPostingText, texte),
  previewJobPosting: (offre) => appeler(CHANNELS.previewJobPosting, offre),
  tailorCv: (offre) => appeler(CHANNELS.tailorCv, offre),
  cancelTailoring: () => appeler(CHANNELS.cancelTailoring),
  openFile: (chemin) => appeler(CHANNELS.openFile, chemin),
  revealInFolder: (chemin) => appeler(CHANNELS.revealInFolder, chemin),
  getSettings: () => appeler(CHANNELS.getSettings),
  saveSettings: (parametres) => appeler(CHANNELS.saveSettings, parametres),
  setApiKey: (cle) => appeler(CHANNELS.setApiKey, cle),
  exportCv: (cv, format, modeleId) => appeler(CHANNELS.exportCv, cv, format, modeleId),
  templateHtml: (cv, modeleId) => appeler(CHANNELS.templateHtml, cv, modeleId),
  generateSummary: (profil) => appeler(CHANNELS.generateSummary, profil),
  getModelsState: () => appeler(CHANNELS.getModelsState),
  downloadModel: (id) => appeler(CHANNELS.downloadModel, id),
  cancelDownload: () => appeler(CHANNELS.cancelDownload),
  deleteModel: (id) => appeler(CHANNELS.deleteModel, id),
  eraseData: () => appeler(CHANNELS.eraseData),
  getUpdateState: () => appeler(CHANNELS.getUpdateState),
  checkForUpdate: () => appeler(CHANNELS.checkForUpdate),
  installUpdate: () => appeler(CHANNELS.installUpdate),
  onUpdate: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, etat: UpdateState) => rappel(etat)
    ipcRenderer.on(CHANNELS.updateStatus, ecouteur)
    return () => ipcRenderer.removeListener(CHANNELS.updateStatus, ecouteur)
  },
  onTaskProgress: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, progression: TaskProgress) => rappel(progression)
    ipcRenderer.on(CHANNELS.taskProgress, ecouteur)
    return () => ipcRenderer.removeListener(CHANNELS.taskProgress, ecouteur)
  },
  onModelProgress: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, progression: ModelDownloadProgress) => rappel(progression)
    ipcRenderer.on(CHANNELS.modelProgress, ecouteur)
    return () => ipcRenderer.removeListener(CHANNELS.modelProgress, ecouteur)
  },
}

contextBridge.exposeInMainWorld('api', api)
