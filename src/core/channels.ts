// Dependency-free (no zod): imported as is by the sandboxed preload.

/** IPC channels (one per API method). */
export const CHANNELS = {
  importCv: 'cv:importer',
  importDroppedCv: 'cv:importer-depose',
  getProfile: 'profil:obtenir',
  saveProfile: 'profil:enregistrer',
  fetchJobPosting: 'offre:recuperer',
  parseJobPostingText: 'offre:analyser-texte',
  previewJobPosting: 'offre:analyser-annonce',
  tailorCv: 'cv:adapter',
  cancelTailoring: 'cv:annuler-adaptation',
  getSettings: 'parametres:lire',
  saveSettings: 'parametres:enregistrer',
  setApiKey: 'parametres:definir-cle',
  exportCv: 'cv:exporter',
  templateHtml: 'cv:html-modele',
  openFile: 'fichier:ouvrir',
  revealInFolder: 'fichier:montrer',
  generateSummary: 'profil:generer-accroche',
  getModelsState: 'modeles:etat',
  downloadModel: 'modeles:telecharger',
  cancelDownload: 'modeles:annuler',
  deleteModel: 'modeles:supprimer',
  modelProgress: 'modeles:progression',
  taskProgress: 'taches:progression',
  eraseData: 'donnees:effacer',
  getUpdateState: 'mise-a-jour:etat',
  checkForUpdate: 'mise-a-jour:verifier',
  installUpdate: 'mise-a-jour:installer',
  updateStatus: 'mise-a-jour:changement',
} as const

/** Serialisable envelope: errors cross the IPC with a readable message. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; message: string; code?: string }

// Electron's context bridge only passes an error's message: added properties (the code) are lost on the way. So the
// code travels at the start of the message, and the interface splits it off on arrival.
const CODE_PATTERN = /^\[\[([a-z-]+)\]\] /

export function encodeError(message: string, code?: string): string {
  return code ? `[[${code}]] ${message}` : message
}

export function decodeError(message: string): { code?: string; message: string } {
  const found = CODE_PATTERN.exec(message)
  return found ? { code: found[1], message: message.slice(found[0].length) } : { message }
}
