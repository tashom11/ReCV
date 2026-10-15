import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { LocalEngine, removeNulls, responseText, toGrammarSchema } from './localEngine'

// Simulated node-llama-cpp: counts what the engine creates, no model is loaded.
const native = vi.hoisted(() => {
  const counts = { grammars: 0, contexts: 0, disposedContexts: 0, clearedHistories: 0, prompting: 0, maxPrompting: 0 }
  const context = () => {
    counts.contexts++
    // Like node-llama-cpp: a single sequence per context, not given back at once when disposed.
    let taken = false
    return {
      getSequence: () => {
        if (taken) throw new Error('No sequences left')
        taken = true
        return {
          clearHistory: async () => {
            counts.clearedHistories++
          },
        }
      },
      dispose: async () => {
        counts.disposedContexts++
      },
    }
  }
  const llama = {
    createGrammarForJsonSchema: async () => {
      counts.grammars++
      return { parse: (text: string) => JSON.parse(text) }
    },
    // 30 of 36 layers fit on the card: the rest runs on the processor.
    loadModel: async () => ({
      gpuLayers: 30,
      fileInsights: { totalLayers: 36 },
      createContext: async () => context(),
      dispose: async () => undefined,
    }),
  }
  class LlamaChatSession {
    async promptWithMeta() {
      counts.prompting++
      counts.maxPrompting = Math.max(counts.maxPrompting, counts.prompting)
      await new Promise((r) => setTimeout(r, 5))
      counts.prompting--
      return { response: ['{"name":"x"}'] }
    }
    dispose() {}
  }
  const options: unknown[] = []
  const getLlama = async (o: unknown) => {
    options.push(o)
    return llama
  }
  return { counts, options, getLlama, LlamaChatSession }
})
vi.mock('node-llama-cpp', () => ({ getLlama: native.getLlama, LlamaChatSession: native.LlamaChatSession }))

describe('LocalEngine', () => {
  const schema = z.object({ name: z.string() })
  const request = { name: 'step', schema, system: 's', user: 'u' }

  beforeEach(() => {
    for (const key of Object.keys(native.counts)) native.counts[key as keyof typeof native.counts] = 0
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('compiles the grammar of a schema once and reuses the context between calls', async () => {
    const engine = new LocalEngine('m.gguf')
    expect(await engine.generateObject(request)).toEqual({ name: 'x' })
    await engine.generateObject(request)
    expect(native.counts.grammars).toBe(1)
    // Prebuilt binaries only: never a compilation of llama.cpp on the user's computer.
    expect(native.options.at(-1)).toMatchObject({ build: 'never' })
    expect(native.counts.contexts).toBe(1)
    // Each call starts from an empty conversation.
    expect(native.counts.clearedHistories).toBe(2)
  })

  it('reports how many layers of the model the graphics card holds, once loaded', async () => {
    const engine = new LocalEngine('m.gguf')
    expect(engine.gpuOffload()).toBeNull()
    await engine.generateObject(request)
    expect(engine.gpuOffload()).toEqual({ layers: 30, total: 36 })
  })

  it('runs simultaneous calls one after the other on the shared context', async () => {
    const engine = new LocalEngine('m.gguf')
    await Promise.all([engine.generateObject(request), engine.generateObject(request)])
    expect(native.counts.maxPrompting).toBe(1)
    expect(native.counts.contexts).toBe(1)
  })

  it('frees the context after a while without calls', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const engine = new LocalEngine('m.gguf')
    const result = engine.generateObject(request)
    await vi.advanceTimersByTimeAsync(10)
    await result
    expect(native.counts.disposedContexts).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(native.counts.disposedContexts).toBe(1)
    // The next call creates a new context.
    const next = engine.generateObject(request)
    await vi.advanceTimersByTimeAsync(10)
    await next
    expect(native.counts.contexts).toBe(2)
  })
})

// Pure functions: no model is loaded.
describe('toGrammarSchema', () => {
  it('makes optional properties nullable and removes $schema/default', () => {
    const schema = z.object({
      title: z.string(),
      location: z.string().optional(),
      bullets: z.array(z.string()).default([]),
    })
    const result = toGrammarSchema(schema) as unknown as Record<string, unknown>
    expect(JSON.stringify(result)).not.toMatch(/"\$schema"|"default"/)
    expect(result.required).toBeUndefined()
    expect(result.properties).toEqual({
      title: { type: 'string' },
      location: { oneOf: [{ type: 'string' }, { type: 'null' }] },
      bullets: { type: 'array', items: { type: 'string' } },
    })
  })
})

describe('removeNulls', () => {
  it('removes null keys deeply', () => {
    expect(removeNulls({ a: null, b: [{ c: null, d: 1 }] })).toEqual({ b: [{ d: 1 }] })
  })
})

describe('responseText', () => {
  it('joins plain text and thought segments back (empty « thinking » answer in responseText)', () => {
    expect(responseText([{ type: 'segment', segmentType: 'thought', text: '{"a":1}' }])).toBe('{"a":1}')
    expect(responseText(['{"a":', { type: 'segment', text: '1}' }])).toBe('{"a":1}')
  })

  it('ignores parts without text (function calls)', () => {
    expect(responseText([{ type: 'functionCall', name: 'x' }, '{}'])).toBe('{}')
  })
})
