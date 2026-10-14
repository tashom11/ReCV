// Sans dépendance (pas de zod) : importé tel quel par le preload sandboxé.

/** Canaux IPC (un par méthode de l'API). */
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

/** Enveloppe sérialisable : les erreurs traversent l'IPC avec un message lisible. */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; message: string; code?: string }

// Le pont de contexte d'Electron ne transmet d'une erreur que son message : les propriétés ajoutées (le code)
// sont perdues en route. Le code voyage donc en tête du message, et l'interface le sépare à l'arrivée.
const CODE_PATTERN = /^\[\[([a-z-]+)\]\] /

export function encodeError(message: string, code?: string): string {
  return code ? `[[${code}]] ${message}` : message
}

export function decodeError(message: string): { code?: string; message: string } {
  const found = CODE_PATTERN.exec(message)
  return found ? { code: found[1], message: message.slice(found[0].length) } : { message }
}
