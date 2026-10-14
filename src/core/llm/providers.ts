import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { AiSdkEngine } from './aiSdkEngine'
import { StructuredProvider } from './structuredProvider'

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434/v1'

export interface OllamaOptions {
  model: string
  baseUrl?: string
}

export function createOllamaProvider({ model, baseUrl = DEFAULT_OLLAMA_URL }: OllamaOptions): StructuredProvider {
  const ollama = createOpenAICompatible({ name: 'ollama', baseURL: baseUrl, supportsStructuredOutputs: true })
  // Thinking disabled (qwen3…): 2 to 3 times faster, with no loss on these extraction/rewriting tasks.
  const engine = new AiSdkEngine(ollama.chatModel(model), {
    providerOptions: { ollama: { reasoningEffort: 'none' } },
  })
  return new StructuredProvider(engine)
}

export interface ApiOptions {
  /** URL de base OpenAI-compatible, ex. https://api.openai.com/v1, https://api.mistral.ai/v1, https://openrouter.ai/api/v1 */
  baseUrl: string
  apiKey: string
  model: string
  /** To disable for an API that refuses `response_format: json_schema` (falls back to plain JSON mode). */
  structuredOutputs?: boolean
}

export function createApiProvider({
  baseUrl,
  apiKey,
  model,
  structuredOutputs = true,
}: ApiOptions): StructuredProvider {
  const api = createOpenAICompatible({
    name: 'api',
    baseURL: baseUrl,
    apiKey: apiKey,
    supportsStructuredOutputs: structuredOutputs,
  })
  return new StructuredProvider(new AiSdkEngine(api.chatModel(model)))
}
