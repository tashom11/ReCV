import type { MoteurLLM, RequeteObjet } from './moteur'

type Reponse = unknown | ((requete: RequeteObjet<unknown>) => unknown)

// Réponses scriptées par nom d'étape, pour les tests : aucun appel LLM réel.
export class MoteurMock implements MoteurLLM {
  readonly requetes: RequeteObjet<unknown>[] = []

  constructor(private readonly reponses: Record<string, Reponse>) {}

  async genererObjet<T>(requete: RequeteObjet<T>): Promise<T> {
    this.requetes.push(requete as RequeteObjet<unknown>)
    const reponse = this.reponses[requete.nom]
    if (reponse === undefined) {
      throw new Error(`MoteurMock : aucune réponse prévue pour l'étape « ${requete.nom} »`)
    }
    const brut = typeof reponse === 'function' ? reponse(requete as RequeteObjet<unknown>) : reponse
    return requete.schema.parse(brut)
  }
}
