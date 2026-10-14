import type { LlmEngine, ObjectRequest } from './engine'

type MockReply = unknown | ((request: ObjectRequest<unknown>) => unknown)

// Réponses scriptées par nom d'étape, pour les tests : aucun appel LLM réel.
export class MockEngine implements LlmEngine {
  readonly requests: ObjectRequest<unknown>[] = []

  constructor(private readonly responses: Record<string, MockReply>) {}

  async generateObject<T>(request: ObjectRequest<T>): Promise<T> {
    request.signal?.throwIfAborted()
    this.requests.push(request as ObjectRequest<unknown>)
    const response = this.responses[request.name]
    if (response === undefined) {
      throw new Error(`MoteurMock : aucune réponse prévue pour l'étape « ${request.name} »`)
    }
    const raw = typeof response === 'function' ? response(request as ObjectRequest<unknown>) : response
    return request.schema.parse(raw)
  }
}
