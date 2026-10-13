import type { z } from 'zod'

export interface RequeteObjet<T> {
  /** Nom de l'étape (journalisation, messages d'erreur, réponses du MoteurMock). */
  nom: string
  schema: z.ZodType<T>
  systeme: string
  utilisateur: string
  /** Température d'échantillonnage (défaut 0,2). 0 pour les étapes de jugement, qui doivent être reproductibles. */
  temperature?: number
}

// Primitive commune à tous les backends : produire un objet validé par un schéma Zod.
// Les prompts et les étapes d'adaptation sont écrits une seule fois au-dessus de cette interface.
export interface MoteurLLM {
  genererObjet<T>(requete: RequeteObjet<T>): Promise<T>
  /** Libère les ressources natives, si le moteur en détient. */
  liberer?(): Promise<void>
  /** Où tourne le calcul (modèle embarqué uniquement) ; `null` tant que le modèle n'est pas chargé. */
  modeCalcul?(): 'gpu' | 'cpu' | null
}
