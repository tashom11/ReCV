import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MoteurAiSdk } from './moteurAiSdk'

// Modèle simulé du SDK : renvoie successivement les textes fournis, sans aucun appel réseau.
function modeleSimule(reponses: string[]) {
  let appel = 0
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: reponses[Math.min(appel++, reponses.length - 1)] ?? '' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  })
}

const schema = z.object({ titre: z.string() })
const requete = { nom: 'essai', schema, systeme: 'système', utilisateur: 'utilisateur' }

describe('MoteurAiSdk', () => {
  it('renvoie l’objet validé', async () => {
    const modele = modeleSimule(['{"titre":"Dev"}'])
    await expect(new MoteurAiSdk(modele).genererObjet(requete)).resolves.toEqual({ titre: 'Dev' })
    expect(modele.doGenerateCalls).toHaveLength(1)
  })

  it('relance une fois après une sortie invalide', async () => {
    const modele = modeleSimule(['pas du json', '{"titre":"Dev"}'])
    await expect(new MoteurAiSdk(modele).genererObjet(requete)).resolves.toEqual({ titre: 'Dev' })
    expect(modele.doGenerateCalls).toHaveLength(2)
  })

  it('échoue avec un message clair après deux sorties invalides', async () => {
    const modele = modeleSimule(['{"autre":1}'])
    await expect(new MoteurAiSdk(modele).genererObjet(requete)).rejects.toThrow(/Étape « essai ».*2 tentatives/)
    expect(modele.doGenerateCalls).toHaveLength(2)
  })
})
