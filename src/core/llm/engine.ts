import type { z } from 'zod'

export interface ObjectRequest<T> {
  /** Nom de l'étape (journalisation, messages d'erreur, réponses du MoteurMock). */
  name: string
  schema: z.ZodType<T>
  system: string
  user: string
  /** Température d'échantillonnage (défaut 0,2). 0 pour les étapes de jugement, qui doivent être reproductibles. */
  temperature?: number
  /** Interrompt la génération (annulation par l'utilisateur). */
  signal?: AbortSignal
}

// Primitive commune à tous les backends : produire un objet validé par un schéma Zod.
// Les prompts et les étapes d'adaptation sont écrits une seule fois au-dessus de cette interface.
export interface LlmEngine {
  generateObject<T>(request: ObjectRequest<T>): Promise<T>
  /** Libère les ressources natives, si le moteur en détient. */
  release?(): Promise<void>
  /** Où tourne le calcul (modèle embarqué uniquement) ; `null` tant que le modèle n'est pas chargé. */
  computeMode?(): 'gpu' | 'cpu' | null
}
