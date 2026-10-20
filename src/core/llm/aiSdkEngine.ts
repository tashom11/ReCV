import { generateText, jsonSchema, type LanguageModel, NoObjectGeneratedError, Output } from 'ai'
import { z } from 'zod'
import type { LlmEngine, ObjectRequest } from './engine'

type SdkProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>

export interface AiSdkEngineOptions {
  attempts?: number
  /** Provider-specific options, e.g. `{ ollama: { reasoningEffort: 'none' } }`. */
  providerOptions?: SdkProviderOptions
}

const JSON_REMINDER =
  "\n\nTa réponse précédente n'était pas un JSON valide pour le schéma attendu. Réponds uniquement avec l'objet JSON demandé."

// Schema sent to the model in « output » mode: lists with `.default([])` are required there.
// (In « input » mode, used by default by the SDK, they are optional and the model leaves them out.)
function schemaForModel<T>(schema: z.ZodType<T>) {
  return jsonSchema<T>(z.toJSONSchema(schema, { io: 'output' }) as Parameters<typeof jsonSchema>[0])
}

// Vercel AI SDK backend: Ollama and OpenAI-compatible APIs (BYOK).
export class AiSdkEngine implements LlmEngine {
  constructor(
    private readonly model: LanguageModel,
    private readonly options: AiSdkEngineOptions = {},
  ) {}

  async generateObject<T>({
    name,
    schema,
    system,
    user,
    temperature,
    maxTokens,
    signal,
  }: ObjectRequest<T>): Promise<T> {
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
          // A cut answer is invalid JSON: it is retried like any invalid output.
          maxOutputTokens: maxTokens,
          providerOptions: this.options.providerOptions,
          abortSignal: signal,
        })
        // Systematic Zod validation: the JSON Schema alone does not guarantee the types on the model side.
        return schema.parse(output)
      } catch (error) {
        if (signal?.aborted) throw error
        // Only invalid outputs justify a retry; network/API errors are passed on as they are.
        if (!NoObjectGeneratedError.isInstance(error) && !(error instanceof z.ZodError)) throw error
        lastError = error
      }
    }
    throw new Error(`Step "${name}": the model did not produce valid JSON after ${attempts} attempts.`, {
      cause: lastError,
    })
  }
}
