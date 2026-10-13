import { generateText, jsonSchema, type LanguageModel, NoObjectGeneratedError, Output } from 'ai'
import { z } from 'zod'
import type { MoteurLLM, RequeteObjet } from './moteur'

type OptionsFournisseurSdk = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

export interface OptionsMoteurAiSdk {
  tentatives?: number
  /** Options propres au fournisseur, ex. `{ ollama: { reasoningEffort: 'none' } }`. */
  optionsFournisseur?: OptionsFournisseurSdk
}

const RAPPEL_JSON =
  "\n\nTa réponse précédente n'était pas un JSON valide pour le schéma attendu. Réponds uniquement avec l'objet JSON demandé."

// Schéma envoyé au modèle en mode « sortie » : les listes avec `.default([])` y sont obligatoires.
// (En mode « entrée », utilisé par défaut par le SDK, elles sont facultatives et le modèle les omet.)
function schemaPourModele<T>(schema: z.ZodType<T>) {
  return jsonSchema<T>(z.toJSONSchema(schema, { io: 'output' }) as Parameters<typeof jsonSchema>[0])
}

// Backend Vercel AI SDK : Ollama et API OpenAI-compatibles (BYOK).
export class MoteurAiSdk implements MoteurLLM {
  constructor(
    private readonly modele: LanguageModel,
    private readonly options: OptionsMoteurAiSdk = {},
  ) {}

  async genererObjet<T>({ nom, schema, systeme, utilisateur, temperature, signal }: RequeteObjet<T>): Promise<T> {
    const tentatives = this.options.tentatives ?? 2
    let derniereErreur: unknown
    for (let tentative = 0; tentative < tentatives; tentative++) {
      try {
        const { output } = await generateText({
          model: this.modele,
          system: systeme,
          prompt: tentative === 0 ? utilisateur : utilisateur + RAPPEL_JSON,
          output: Output.object({ schema: schemaPourModele(schema) }),
          temperature: temperature ?? 0.2,
          ...(temperature === 0 ? { seed: 42 } : {}),
          providerOptions: this.options.optionsFournisseur,
          abortSignal: signal,
        })
        // Validation Zod systématique : le JSON Schema seul ne garantit pas les types côté modèle.
        return schema.parse(output)
      } catch (erreur) {
        if (signal?.aborted) throw erreur
        // Seules les sorties invalides justifient une relance ; les erreurs réseau/API remontent telles quelles.
        if (!NoObjectGeneratedError.isInstance(erreur) && !(erreur instanceof z.ZodError)) throw erreur
        derniereErreur = erreur
      }
    }
    throw new Error(`Étape « ${nom} » : le modèle n'a pas produit de JSON valide après ${tentatives} tentatives.`, {
      cause: derniereErreur,
    })
  }
}
