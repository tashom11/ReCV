import type { Llama, LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import type { LlmEngine, ObjectRequest } from './engine'
import { StructuredProvider } from './structuredProvider'

type GrammarSchema = Parameters<Llama['createGrammarForJsonSchema']>[0]

type Json = Record<string, unknown>

// Convertit un schéma Zod en JSON Schema accepté par la grammaire de node-llama-cpp :
// retire `$schema` et `default`, et rend nullables les propriétés optionnelles, car la grammaire
// impose toutes les clés (sans `null` possible, le modèle serait forcé d'inventer une valeur).
export function toGrammarSchema(schema: z.ZodType): GrammarSchema {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean)
    if (value === null || typeof value !== 'object') return value
    const parsed = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== '$schema' && key !== 'default')
        .map(([key, subValue]) => [key, clean(subValue)]),
    ) as Json
    if (parsed.properties && typeof parsed.properties === 'object') {
      const requiredKeys = new Set(Array.isArray(parsed.required) ? parsed.required : [])
      const properties = Object.entries(parsed.properties as Json).map(([key, property]) => [
        key,
        requiredKeys.has(key) ? property : { oneOf: [property, { type: 'null' }] },
      ])
      parsed.properties = Object.fromEntries(properties)
      delete parsed.required
    }
    return parsed
  }
  return clean(z.toJSONSchema(schema)) as GrammarSchema
}

// Recolle tout le texte généré. Les modèles « à réflexion » (Qwen3.5…) ouvrent le tour par <think> : ce que la
// grammaire force à produire est alors rangé dans un segment de pensée et `responseText` est vide
// (« Unexpected end of JSON input »). Avec une grammaire, tout le texte généré EST la réponse.
export function responseText(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return part
      const text = (part as { text?: unknown } | null)?.text
      return typeof text === 'string' ? text : ''
    })
    .join('')
}

// Retire les `null` produits pour les champs optionnels avant la validation Zod.
export function removeNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNulls)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, subValue]) => subValue !== null)
      .map(([key, subValue]) => [key, removeNulls(subValue)]),
  )
}

// Contexte (prompt + réponse) : un CV ou une offre font 1 000 à 4 000 jetons, la réponse JSON autant.
// Sans consigne, node-llama-cpp dimensionne le contexte sur la VRAM restante, parfois à quelques centaines
// de jetons : la génération s'arrête alors en plein JSON (« Unexpected end of JSON input »).
const TARGET_CONTEXT_SIZE = 8192
const MIN_CONTEXT_SIZE = 4096
const GPU_RETRY_DELAY_MS = 60_000

const OUT_OF_MEMORY_MESSAGE =
  'Mémoire insuffisante pour le modèle embarqué. Fermez les applications qui utilisent la carte graphique ' +
  '(Ollama, jeux, autre fenêtre de Re:CV…) ou choisissez « Rapide » dans les réglages.'

// Modèle embarqué (.gguf) : la sortie est contrainte par une grammaire dérivée du schéma Zod.
// Fichier volontairement non exporté par `llm/index.ts` : node-llama-cpp est natif, réservé au process Node.
export class LocalEngine implements LlmEngine {
  private loading?: Promise<{ llama: Llama; model: LlamaModel }>
  private onCpu = false
  private lastCpuFallback = 0

  constructor(private readonly modelPath: string) {}

  private load(onCpu = this.onCpu) {
    if (this.loading) return this.loading
    const loading = (async () => {
      // Import dynamique : node-llama-cpp est ESM avec top-level await (incompatible avec require).
      const { getLlama } = await import('node-llama-cpp')
      // Repli processeur : instance SANS backend GPU, pour que ni les poids ni le cache de contexte ne réclament de VRAM.
      const llama = await getLlama(onCpu ? { gpu: false } : undefined)
      // GPU : autant de couches que possible TOUT EN laissant la place d'un contexte de CONTEXTE_CIBLE jetons.
      const model = await llama.loadModel({
        modelPath: this.modelPath,
        gpuLayers: onCpu ? 0 : { fitContext: { contextSize: TARGET_CONTEXT_SIZE } },
      })
      return { llama, model }
    })()
    this.loading = loading
    // Un chargement en échec ne doit pas rester en cache : sinon le repli CPU relirait l'échec.
    loading.catch(() => {
      if (this.loading === loading) this.loading = undefined
    })
    return loading
  }

  // Si le contexte ne tient pas en VRAM (autre application, Ollama…), on recharge le modèle sur le processeur :
  // plus lent, mais le résultat est correct.
  computeMode(): 'gpu' | 'cpu' | null {
    if (!this.loading) return null
    return this.onCpu ? 'cpu' : 'gpu'
  }

  private async createContext() {
    // Le repli CPU n'est pas définitif : la VRAM a pu se libérer (autre application fermée). On retente le GPU
    // si le dernier repli date de plus d'une minute.
    if (this.onCpu && Date.now() - this.lastCpuFallback > GPU_RETRY_DELAY_MS) {
      await this.release()
      this.onCpu = false
    }
    const options = { contextSize: { min: MIN_CONTEXT_SIZE, max: TARGET_CONTEXT_SIZE } }
    try {
      const { model } = await this.load()
      return await model.createContext(options)
    } catch (error) {
      if (this.onCpu) throw new Error(OUT_OF_MEMORY_MESSAGE, { cause: error })
      await this.release()
      this.onCpu = true
      this.lastCpuFallback = Date.now()
      try {
        const { model } = await this.load(true)
        return await model.createContext(options)
      } catch (cpuError) {
        throw new Error(OUT_OF_MEMORY_MESSAGE, { cause: cpuError })
      }
    }
  }

  async generateObject<T>({ schema, system, user, temperature, signal }: ObjectRequest<T>): Promise<T> {
    signal?.throwIfAborted()
    const context = await this.createContext()
    const { llama } = await this.load()
    const grammar = await llama.createGrammarForJsonSchema(toGrammarSchema(schema))
    const { LlamaChatSession } = await import('node-llama-cpp')
    try {
      const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: system })
      const meta = await session.promptWithMeta(user, {
        grammar: grammar,
        temperature: temperature ?? 0.2,
        signal,
      })
      // Une génération interrompue rend un texte partiel : ce n'est pas une réponse.
      signal?.throwIfAborted()
      const response = responseText(meta.response)
      let parsed: unknown
      try {
        parsed = grammar.parse(response)
      } catch (error) {
        throw new Error(
          'Réponse du modèle incomplète (texte trop long pour le contexte, ou mémoire insuffisante). ' +
            'Raccourcissez le texte ou choisissez un autre modèle.',
          { cause: error },
        )
      }
      return schema.parse(removeNulls(parsed))
    } finally {
      await context.dispose()
    }
  }

  async release(): Promise<void> {
    const loading = this.loading
    this.loading = undefined
    if (!loading) return
    try {
      const { model } = await loading
      await model.dispose()
    } catch {
      // Chargement échoué : il n'y a rien à libérer.
    }
  }
}

export function createLocalProvider({ modelPath }: { modelPath: string }): StructuredProvider {
  return new StructuredProvider(new LocalEngine(modelPath))
}
