// Provider creation shared by the command-line scripts (trial, benchmark).
// Configuration through environment variables (never a key as an argument):
//   RECV_OLLAMA_URL  (default http://localhost:11434/v1)
//   RECV_API_URL, RECV_API_KEY  (« api » provider, OpenAI-compatible)
//   RECV_GGUF_MODEL  (« local » provider, path of the .gguf file, unless given by --model)
import { createApiProvider, createOllamaProvider, type LlmProvider } from '../src/core/llm'

export const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'

function requiredVariable(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`missing environment variable ${name}`)
  return value
}

export async function createProvider(provider: string, model: string | undefined): Promise<LlmProvider> {
  switch (provider) {
    case 'ollama':
      return createOllamaProvider({ model: model ?? DEFAULT_OLLAMA_MODEL, baseUrl: process.env.RECV_OLLAMA_URL })
    case 'api':
      if (!model) throw new Error('--model is required with --provider api')
      return createApiProvider({
        baseUrl: requiredVariable('RECV_API_URL'),
        apiKey: requiredVariable('RECV_API_KEY'),
        model,
      })
    case 'local': {
      const { createLocalProvider } = await import('../src/core/llm/localEngine')
      return createLocalProvider({ modelPath: model ?? requiredVariable('RECV_GGUF_MODEL') })
    }
    default:
      throw new Error(`unknown provider "${provider}" (ollama, api or local)`)
  }
}
