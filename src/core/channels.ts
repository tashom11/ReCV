// Dependency-free (no zod): imported as is by the sandboxed preload.

/** IPC channels (one per API method). */
export const CHANNELS = {
  importCv: 'cv:import',
  importDroppedCv: 'cv:import-dropped',
  getProfile: 'profile:get',
  saveProfile: 'profile:save',
  fetchJobPosting: 'job:fetch',
  parseJobPostingText: 'job:parse-text',
  previewJobPosting: 'job:preview',
  tailorCv: 'cv:tailor',
  cancelTailoring: 'cv:cancel-tailoring',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  setApiKey: 'settings:set-api-key',
  exportCv: 'cv:export',
  templateHtml: 'cv:template-html',
  openFile: 'file:open',
  revealInFolder: 'file:reveal',
  generateSummary: 'profile:generate-summary',
  getModelsState: 'models:get-state',
  downloadModel: 'models:download',
  cancelDownload: 'models:cancel',
  deleteModel: 'models:delete',
  modelProgress: 'models:progress',
  taskProgress: 'tasks:progress',
  eraseData: 'data:erase',
  getUpdateState: 'update:get-state',
  checkForUpdate: 'update:check',
  installUpdate: 'update:install',
  updateStatus: 'update:changed',
  copyDiagnosticReport: 'diagnostics:copy-report',
  chooseModelFile: 'models:choose-file',
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
