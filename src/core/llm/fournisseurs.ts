import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { FournisseurStructure } from './fournisseurStructure'
import { MoteurAiSdk } from './moteurAiSdk'

export const URL_OLLAMA_DEFAUT = 'http://localhost:11434/v1'

export interface OptionsOllama {
  modele: string
  urlBase?: string
}

export function creerFournisseurOllama({ modele, urlBase = URL_OLLAMA_DEFAUT }: OptionsOllama): FournisseurStructure {
  const ollama = createOpenAICompatible({ name: 'ollama', baseURL: urlBase, supportsStructuredOutputs: true })
  // Réflexion désactivée (qwen3…) : 2 à 3 fois plus rapide, sans perte sur ces tâches d'extraction/réécriture.
  const moteur = new MoteurAiSdk(ollama.chatModel(modele), {
    optionsFournisseur: { ollama: { reasoningEffort: 'none' } },
  })
  return new FournisseurStructure(moteur)
}

export interface OptionsApi {
  /** URL de base OpenAI-compatible, ex. https://api.openai.com/v1, https://api.mistral.ai/v1, https://openrouter.ai/api/v1 */
  urlBase: string
  cleApi: string
  modele: string
  /** À désactiver pour une API qui refuse `response_format: json_schema` (repli sur le mode JSON simple). */
  sortiesStructurees?: boolean
}

export function creerFournisseurApi({
  urlBase,
  cleApi,
  modele,
  sortiesStructurees = true,
}: OptionsApi): FournisseurStructure {
  const api = createOpenAICompatible({
    name: 'api',
    baseURL: urlBase,
    apiKey: cleApi,
    supportsStructuredOutputs: sortiesStructurees,
  })
  return new FournisseurStructure(new MoteurAiSdk(api.chatModel(modele)))
}
