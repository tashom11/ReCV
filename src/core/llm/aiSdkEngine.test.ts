import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AiSdkEngine } from './aiSdkEngine'

// Modèle simulé du SDK : renvoie successivement les textes fournis, sans aucun appel réseau.
function simulatedModel(responses: string[]) {
  let call = 0
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: responses[Math.min(call++, responses.length - 1)] ?? '' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  })
}

const schema = z.object({ title: z.string() })
const request = { name: 'essai', schema, system: 'système', user: 'utilisateur' }

describe('MoteurAiSdk', () => {
  it('renvoie l’objet validé', async () => {
    const model = simulatedModel(['{"title":"Dev"}'])
    await expect(new AiSdkEngine(model).generateObject(request)).resolves.toEqual({ title: 'Dev' })
    expect(model.doGenerateCalls).toHaveLength(1)
  })

  it('relance une fois après une sortie invalide', async () => {
    const model = simulatedModel(['pas du json', '{"title":"Dev"}'])
    await expect(new AiSdkEngine(model).generateObject(request)).resolves.toEqual({ title: 'Dev' })
    expect(model.doGenerateCalls).toHaveLength(2)
  })

  it('échoue avec un message clair après deux sorties invalides', async () => {
    const model = simulatedModel(['{"autre":1}'])
    await expect(new AiSdkEngine(model).generateObject(request)).rejects.toThrow(/Étape « essai ».*2 tentatives/)
    expect(model.doGenerateCalls).toHaveLength(2)
  })
})
