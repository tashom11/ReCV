import { totalmem } from 'node:os'
import type { Resources } from '@core/llm'

const GB = 1024 ** 3
const round = (bytes: number) => Math.round((bytes / GB) * 10) / 10

/**
 * RAM from the OS, VRAM from node-llama-cpp (imported dynamically: native, ESM with top-level await).
 * Without a usable GPU or if loading fails, VRAM is 0.
 */
export async function detectResources(): Promise<Resources> {
  let vramGo = 0
  try {
    const { getLlama } = await import('node-llama-cpp')
    const llama = await getLlama()
    vramGo = round((await llama.getVramState()).total)
  } catch {
    // ignored: falls back to the CPU
  }
  return { ramGb: round(totalmem()), vramGb: vramGo }
}
