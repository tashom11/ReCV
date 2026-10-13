/** Cas d'erreur que l'interface distingue pour proposer la bonne action (les autres restent un message brut). */
export type CodeErreur = 'annule' | 'fichier-illisible' | 'moteur-absent' | 'ecriture-impossible' | 'profil-absent'

/** Erreur dont le code traverse l'IPC : l'interface en tire un titre, une explication et une action. */
export class ErreurCodee extends Error {
  readonly code: CodeErreur

  constructor(code: CodeErreur, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ErreurCodee'
    this.code = code
  }
}
