import type { Llama, LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import type { GpuOffload, LlmEngine, ObjectRequest } from './engine'
import { StructuredProvider } from './structuredProvider'

type GrammarSchema = Parameters<Llama['createGrammarForJsonSchema']>[0]
type Grammar = Awaited<ReturnType<Llama['createGrammarForJsonSchema']>>
type Context = Awaited<ReturnType<LlamaModel['createContext']>>
type Sequence = ReturnType<Context['getSequence']>

type Json = Record<string, unknown>

// Converts a Zod schema to a JSON Schema accepted by the node-llama-cpp grammar: removes `$schema` and `default`, and
// makes optional properties nullable, because the grammar requires every key (without a possible `null`, the model
// would be forced to make up a value).
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

// Joins all the generated text back. « Thinking » models (Qwen3.5…) open their turn with <think>: what the grammar
// forces them to produce is then put in a thought segment and `responseText` is empty (« Unexpected end of JSON
// input »). With a grammar, all the generated text IS the answer.
export function responseText(parts: readonly unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return part
      const text = (part as { text?: unknown } | null)?.text
      return typeof text === 'string' ? text : ''
    })
    .join('')
}

// Removes the `null` produced for optional fields before Zod validation.
export function removeNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNulls)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, subValue]) => subValue !== null)
      .map(([key, subValue]) => [key, removeNulls(subValue)]),
  )
}

// Context (prompt + answer): a CV or a job posting is 1,000 to 4,000 tokens, the JSON answer as much.
// Without guidance, node-llama-cpp sizes the context on the remaining VRAM, sometimes a few hundred tokens: generation
// then stops in the middle of the JSON (« Unexpected end of JSON input »).
const TARGET_CONTEXT_SIZE = 8192
const MIN_CONTEXT_SIZE = 4096
// "Reduce graphics card memory" setting: the context is kept at its minimum, which frees VRAM for the model's layers.
const REDUCED_CONTEXT_SIZE = MIN_CONTEXT_SIZE
const GPU_RETRY_DELAY_MS = 60_000
// The context (and its cache in VRAM) is kept between the calls of a tailoring, then freed after this idle time.
const CONTEXT_IDLE_MS = 30_000

const OUT_OF_MEMORY_MESSAGE =
  'Mémoire insuffisante pour le modèle embarqué. Fermez les applications qui utilisent la carte graphique ' +
  '(Ollama, jeux, autre fenêtre de Re:CV…) ou choisissez « Rapide » dans les réglages.'

// The answer reached `maxTokens`: the model was repeating itself (the bound leaves room for any normal answer).
class TruncatedAnswerError extends Error {
  constructor() {
    super(
      'Le modèle s’est mis à répéter sa réponse sans s’arrêter. Réessayez, ou choisissez un autre modèle dans les ' +
        'réglages.',
    )
  }
}

// Local model (.gguf): the output is constrained by a grammar derived from the Zod schema.
// File deliberately not exported by `llm/index.ts`: node-llama-cpp is native, for the Node process only.
export class LocalEngine implements LlmEngine {
  private loading?: Promise<{ llama: Llama; model: LlamaModel }>
  private onCpu = false
  private lastCpuFallback = 0
  // What the last load put on the graphics card; `null` while no model is loaded.
  private offload: GpuOffload | null = null
  // A disposed sequence is not given back to its context at once: the single sequence is kept and emptied instead.
  private context?: { context: Context; sequence: Sequence }
  private idleTimer?: ReturnType<typeof setTimeout>
  // Grammars compiled for the current instance, by schema: compiling one takes time and the schemas are reused.
  private grammars = new WeakMap<z.ZodType, Promise<Grammar>>()
  // Calls run one after the other: the shared context has a single sequence.
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly modelPath: string,
    private readonly contextSize = TARGET_CONTEXT_SIZE,
  ) {}

  private load(onCpu = this.onCpu) {
    if (this.loading) return this.loading
    const loading = (async () => {
      // Dynamic import: node-llama-cpp is ESM with top-level await (incompatible with require).
      const { getLlama } = await import('node-llama-cpp')
      // Processor fallback: an instance WITHOUT GPU backend, so
      // that neither the weights nor the context cache claim VRAM.
      // Prebuilt binaries only: without them, node-llama-cpp would try to compile llama.cpp for minutes.
      const llama = await getLlama(onCpu ? { gpu: false, build: 'never' } : { build: 'never' })
      // GPU: as many layers as possible WHILE leaving room for a context of TARGET_CONTEXT_SIZE tokens.
      const model = await llama.loadModel({
        modelPath: this.modelPath,
        gpuLayers: onCpu ? 0 : { fitContext: { contextSize: this.contextSize } },
      })
      // Layers actually held by the card: fewer than the total when the VRAM is short, the rest runs on the processor.
      this.offload = { layers: onCpu ? 0 : model.gpuLayers, total: model.fileInsights.totalLayers }
      return { llama, model }
    })()
    this.loading = loading
    // A failed load must not stay cached: otherwise the CPU fallback would read the failure again.
    loading.catch(() => {
      if (this.loading === loading) this.loading = undefined
    })
    return loading
  }

  // If the context does not fit in VRAM (another application, Ollama…), the model is reloaded on the processor:
  // slower, but the result is correct.
  computeMode(): 'gpu' | 'cpu' | null {
    if (!this.loading) return null
    return this.onCpu ? 'cpu' : 'gpu'
  }

  gpuOffload(): GpuOffload | null {
    return this.loading ? this.offload : null
  }

  private async createContext() {
    // The CPU fallback is not final: VRAM may have been freed (another application closed). The GPU is tried again
    // if the last fallback is more than a minute old.
    if (this.onCpu && Date.now() - this.lastCpuFallback > GPU_RETRY_DELAY_MS) {
      await this.release()
      this.onCpu = false
    }
    const options = { contextSize: { min: Math.min(MIN_CONTEXT_SIZE, this.contextSize), max: this.contextSize } }
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

  // Context of the previous call, unless the processor fallback is old enough to try the GPU again.
  private async sharedSequence(): Promise<Sequence> {
    clearTimeout(this.idleTimer)
    const retryGpu = this.onCpu && Date.now() - this.lastCpuFallback > GPU_RETRY_DELAY_MS
    if (this.context && !retryGpu) return this.context.sequence
    await this.disposeContext()
    const context = await this.createContext()
    this.context = { context, sequence: context.getSequence() }
    return this.context.sequence
  }

  private async disposeContext(): Promise<void> {
    clearTimeout(this.idleTimer)
    const shared = this.context
    this.context = undefined
    await shared?.context.dispose()
  }

  private grammarFor(llama: Llama, schema: z.ZodType): Promise<Grammar> {
    let grammar = this.grammars.get(schema)
    if (!grammar) {
      grammar = llama.createGrammarForJsonSchema(toGrammarSchema(schema))
      this.grammars.set(schema, grammar)
      grammar.catch(() => this.grammars.delete(schema))
    }
    return grammar
  }

  generateObject<T>(request: ObjectRequest<T>): Promise<T> {
    const run = this.queue.then(() => this.generateWithRetry(request))
    this.queue = run.catch(() => undefined)
    return run
  }

  // A repetition loop depends on sampling: a second attempt usually ends normally.
  private async generateWithRetry<T>(request: ObjectRequest<T>): Promise<T> {
    try {
      return await this.generate(request)
    } catch (error) {
      if (!(error instanceof TruncatedAnswerError)) throw error
      return this.generate(request)
    }
  }

  private async generate<T>({ schema, system, user, temperature, maxTokens, signal }: ObjectRequest<T>): Promise<T> {
    signal?.throwIfAborted()
    const sequence = await this.sharedSequence()
    const { llama } = await this.load()
    const grammar = await this.grammarFor(llama, schema)
    const { LlamaChatSession } = await import('node-llama-cpp')
    // Nothing of the previous call is left in the conversation.
    await sequence.clearHistory()
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt: system,
      autoDisposeSequence: false,
    })
    try {
      const meta = await session.promptWithMeta(user, {
        grammar: grammar,
        temperature: temperature ?? 0.2,
        maxTokens,
        signal,
      })
      // An interrupted generation returns partial text: it is not an answer.
      signal?.throwIfAborted()
      if (meta.stopReason === 'maxTokens') throw new TruncatedAnswerError()
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
      session.dispose({ disposeSequence: false })
      this.idleTimer = setTimeout(() => void this.disposeContext(), CONTEXT_IDLE_MS)
      // The timer alone must not keep the process alive (command-line trial).
      this.idleTimer.unref?.()
    }
  }

  async release(): Promise<void> {
    await this.disposeContext()
    // The grammars belong to the released instance.
    this.grammars = new WeakMap()
    const loading = this.loading
    this.loading = undefined
    if (!loading) return
    try {
      const { model } = await loading
      await model.dispose()
    } catch {
      // Failed load: there is nothing to free.
    }
  }
}

export function createLocalProvider({
  modelPath,
  reduceGpuMemory = false,
}: {
  modelPath: string
  reduceGpuMemory?: boolean
}): StructuredProvider {
  return new StructuredProvider(
    new LocalEngine(modelPath, reduceGpuMemory ? REDUCED_CONTEXT_SIZE : TARGET_CONTEXT_SIZE),
  )
}
