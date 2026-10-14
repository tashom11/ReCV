import { describe, expect, it, vi } from 'vitest'
import { detectResources } from './resources'

// Simulated node-llama-cpp: counts the loads of the native engine.
const native = vi.hoisted(() => {
  const counts = { getLlama: 0 }
  const getLlama = async () => {
    counts.getLlama++
    return { getVramState: async () => ({ total: 8 * 1024 ** 3 }) }
  }
  return { counts, getLlama }
})
vi.mock('node-llama-cpp', () => ({ getLlama: native.getLlama }))

describe('detectResources', () => {
  it('loads the native engine only once per session', async () => {
    const first = await detectResources()
    const second = await detectResources()
    expect(first.vramGb).toBe(8)
    expect(second).toEqual(first)
    expect(native.counts.getLlama).toBe(1)
  })
})
