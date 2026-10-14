import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AiSdkEngine } from './aiSdkEngine'

// Simulated SDK model: returns the given texts one after the other, without any network call.
function simulatedModel(responses: string[]) {
  let call = 0
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: responses[Math.min(call++, responses.length - 1)] ?? '' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  })
}

const schema = z.object({ title: z.string() })
const request = { name: 'essai', schema, system: 'système', user: 'utilisateur' }

describe('AiSdkEngine', () => {
  it('returns the validated object', async () => {
    const model = simulatedModel(['{"title":"Dev"}'])
    await expect(new AiSdkEngine(model).generateObject(request)).resolves.toEqual({ title: 'Dev' })
    expect(model.doGenerateCalls).toHaveLength(1)
  })

  it('retries once after an invalid output', async () => {
    const model = simulatedModel(['pas du json', '{"title":"Dev"}'])
    await expect(new AiSdkEngine(model).generateObject(request)).resolves.toEqual({ title: 'Dev' })
    expect(model.doGenerateCalls).toHaveLength(2)
  })

  it('fails with a clear message after two invalid outputs', async () => {
    const model = simulatedModel(['{"autre":1}'])
    await expect(new AiSdkEngine(model).generateObject(request)).rejects.toThrow(/Step "essai".*2 attempts/)
    expect(model.doGenerateCalls).toHaveLength(2)
  })
})
