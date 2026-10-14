/** Error cases the interface tells apart to offer the right action (the others stay a raw message). */
export type ErrorCode = 'annule' | 'fichier-illisible' | 'moteur-absent' | 'ecriture-impossible' | 'profil-absent'

/** Error whose code crosses the IPC: the interface derives a title, an explanation and an action from it. */
export class CodedError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ErreurCodee'
    this.code = code
  }
}
