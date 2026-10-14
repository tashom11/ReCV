import { generateText, jsonSchema, type LanguageModel, NoObjectGeneratedError, Output } from 'ai'
import { z } from 'zod'
import type { LlmEngine, ObjectRequest } from './engine'

type SdkProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

export interface AiSdkEngineOptions {
  attempts?: number
  /** Options propres au fournisseur, ex. `{ ollama: { reasoningEffort: 'none' } }`. */
  optionsFournisseur?: SdkProviderOptions
}

const JSON_REMINDER =
  "\n\nTa réponse précédente n'était pas un JSON valide pour le schéma attendu. Réponds uniquement avec l'objet JSON demandé."

// Schéma envoyé au modèle en mode « sortie » : les listes avec `.default([])` y sont obligatoires.
// (En mode « entrée », utilisé par défaut par le SDK, elles sont facultatives et le modèle les omet.)
function schemaForModel<T>(schema: z.ZodType<T>) {
  return jsonSchema<T>(z.toJSONSchema(schema, { io: 'output' }) as Parameters<typeof jsonSchema>[0])
}

// Backend Vercel AI SDK : Ollama et API OpenAI-compatibles (BYOK).
export class AiSdkEngine implements LlmEngine {
  constructor(
    private readonly model: LanguageModel,
    private readonly options: AiSdkEngineOptions = {},
  ) {}

  async generateObject<T>({ name, schema, system, user, temperature, signal }: ObjectRequest<T>): Promise<T> {
    const attempts = this.options.attempts ?? 2
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const { output } = await generateText({
          model: this.model,
          system: system,
          prompt: attempt === 0 ? user : user + JSON_REMINDER,
          output: Output.object({ schema: schemaForModel(schema) }),
          temperature: temperature ?? 0.2,
          ...(temperature === 0 ? { seed: 42 } : {}),
          providerOptions: this.options.optionsFournisseur,
          abortSignal: signal,
        })
        // Validation Zod systématique : le JSON Schema seul ne garantit pas les types côté modèle.
        return schema.parse(output)
      } catch (error) {
        if (signal?.aborted) throw error
        // Seules les sorties invalides justifient une relance ; les erreurs réseau/API remontent telles quelles.
        if (!NoObjectGeneratedError.isInstance(error) && !(error instanceof z.ZodError)) throw error
        lastError = error
      }
    }
    throw new Error(`Étape « ${name} » : le modèle n'a pas produit de JSON valide après ${attempts} tentatives.`, {
      cause: lastError,
    })
  }
}
