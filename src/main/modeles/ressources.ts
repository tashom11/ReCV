import { totalmem } from 'node:os'
import type { Resources } from '@core/llm'

const GO = 1024 ** 3
const arrondi = (octets: number) => Math.round((octets / GO) * 10) / 10

/**
 * RAM via l'OS, VRAM via node-llama-cpp (importé dynamiquement : natif, ESM à top-level await).
 * Sans GPU exploitable ou en cas d'échec de chargement, la VRAM vaut 0.
 */
export async function detecterRessources(): Promise<Resources> {
  let vramGo = 0
  try {
    const { getLlama } = await import('node-llama-cpp')
    const llama = await getLlama()
    vramGo = arrondi((await llama.getVramState()).total)
  } catch {
    // ignoré : repli sur le CPU
  }
  return { ramGb: arrondi(totalmem()), vramGb: vramGo }
}
