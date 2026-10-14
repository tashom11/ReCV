import { totalmem } from 'node:os'
import type { Resources } from '@core/llm'

const GB = 1024 ** 3
const round = (bytes: number) => Math.round((bytes / GB) * 10) / 10

/**
 * RAM from the OS, VRAM from node-llama-cpp (imported dynamically: native, ESM with top-level await).
 * Without a usable GPU or if loading fails, VRAM is 0. The totals do not change while the app runs: they are detected
 * once per session (loading the native engine takes time).
 */
export function detectResources(): Promise<Resources> {
  detection ??= detect()
  return detection
}

let detection: Promise<Resources> | undefined

async function detect(): Promise<Resources> {
  let vramGb = 0
  try {
    const { getLlama } = await import('node-llama-cpp')
    const llama = await getLlama()
    vramGb = round((await llama.getVramState()).total)
  } catch {
    // ignored: falls back to the CPU
  }
  return { ramGb: round(totalmem()), vramGb }
}
