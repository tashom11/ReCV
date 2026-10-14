/** Cas d'erreur que l'interface distingue pour proposer la bonne action (les autres restent un message brut). */
export type ErrorCode = 'annule' | 'fichier-illisible' | 'moteur-absent' | 'ecriture-impossible' | 'profil-absent'

/** Erreur dont le code traverse l'IPC : l'interface en tire un titre, une explication et une action. */
export class CodedError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ErreurCodee'
    this.code = code
  }
}
