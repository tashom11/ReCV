import { type ApiService, CHANNELS, type IpcResult, ipcInputs } from '@core/api'
import { CodedError } from '@core/errors'
import { JobPostingFetchError } from '@core/job-posting'
import type { IpcMain } from 'electron'
import type { ZodType } from 'zod'

function analyser<T>(schema: ZodType<T>, valeur: unknown): T {
  const resultat = schema.safeParse(valeur)
  if (!resultat.success) throw new Error('Données invalides reçues par le process principal.')
  return resultat.data
}

function enveloppe(erreur: unknown): IpcResult<never> {
  if (erreur instanceof JobPostingFetchError || erreur instanceof CodedError)
    return { ok: false, message: erreur.message, code: erreur.code }
  return { ok: false, message: erreur instanceof Error ? erreur.message : String(erreur) }
}

/**
 * Branche l'API sur ipcMain. Chaque entrée du renderer est revalidée par Zod :
 * le renderer n'est jamais considéré comme fiable.
 */
export function enregistrerHandlers(
  ipcMain: IpcMain,
  api: ApiService,
  /** Reçoit l'URL de la frame appelante ; refuse tout ce qui n'est pas l'interface de l'application. */
  expediteurAutorise: (url: string) => boolean = () => true,
): void {
  const gerer = (canal: string, traitement: (...args: unknown[]) => Promise<unknown>) => {
    ipcMain.handle(canal, async (evenement, ...args): Promise<IpcResult<unknown>> => {
      try {
        if (!expediteurAutorise(evenement.senderFrame?.url ?? '')) throw new Error('Appel IPC refusé.')
        return { ok: true, value: await traitement(...args) }
      } catch (erreur) {
        return enveloppe(erreur)
      }
    })
  }

  gerer(CHANNELS.importCv, () => api.importCv())
  gerer(CHANNELS.importDroppedCv, (chemin) => api.importDroppedCv(analyser(ipcInputs.path, chemin)))
  gerer(CHANNELS.getProfile, () => api.getProfile())
  gerer(CHANNELS.saveProfile, (profil) => api.saveProfile(analyser(ipcInputs.profile, profil)))
  gerer(CHANNELS.fetchJobPosting, (url) => api.fetchJobPosting(analyser(ipcInputs.url, url)))
  gerer(CHANNELS.parseJobPostingText, (texte) => api.parseJobPostingText(analyser(ipcInputs.text, texte)))
  gerer(CHANNELS.previewJobPosting, (offre) => api.previewJobPosting(analyser(ipcInputs.jobPosting, offre)))
  gerer(CHANNELS.tailorCv, (offre) => api.tailorCv(analyser(ipcInputs.jobPosting, offre)))
  gerer(CHANNELS.cancelTailoring, () => api.cancelTailoring())
  gerer(CHANNELS.openFile, (chemin) => api.openFile(analyser(ipcInputs.path, chemin)))
  gerer(CHANNELS.revealInFolder, (chemin) => api.revealInFolder(analyser(ipcInputs.path, chemin)))
  gerer(CHANNELS.getSettings, () => api.getSettings())
  gerer(CHANNELS.saveSettings, (p) => api.saveSettings(analyser(ipcInputs.settings, p)))
  gerer(CHANNELS.generateSummary, (profil) => api.generateSummary(analyser(ipcInputs.profile, profil)))
  gerer(CHANNELS.exportCv, (cv, format, modele) =>
    api.exportCv(
      analyser(ipcInputs.cv, cv),
      analyser(ipcInputs.format, format),
      modele === undefined ? undefined : analyser(ipcInputs.cvTemplateId, modele),
    ),
  )
  gerer(CHANNELS.templateHtml, (cv, modele) =>
    api.templateHtml(analyser(ipcInputs.cv, cv), analyser(ipcInputs.cvTemplateId, modele)),
  )
  gerer(CHANNELS.getModelsState, () => api.getModelsState())
  gerer(CHANNELS.downloadModel, (id) => api.downloadModel(analyser(ipcInputs.templateId, id)))
  gerer(CHANNELS.cancelDownload, () => api.cancelDownload())
  gerer(CHANNELS.deleteModel, (id) => api.deleteModel(analyser(ipcInputs.templateId, id)))
  gerer(CHANNELS.eraseData, () => api.eraseData())
  gerer(CHANNELS.getUpdateState, () => api.getUpdateState())
  gerer(CHANNELS.checkForUpdate, () => api.checkForUpdate())
  gerer(CHANNELS.installUpdate, () => api.installUpdate())
  gerer(CHANNELS.setApiKey, (cle) => api.setApiKey(analyser(ipcInputs.key, cle)))
}
