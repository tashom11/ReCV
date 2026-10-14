// Catalogue of local models (Q4_K_M quantised GGUF, « unsloth » repositories on Hugging Face).
// Size and SHA-256 digest come from the repository LFS metadata: the file is verified after download.

export type ModelLevel = 'fast' | 'balanced' | 'quality'

export interface LocalModel {
  id: string
  /** What the model means for the user: speed or care of the result (named by the interface). */
  level: ModelLevel
  name: string
  description: string
  fileName: string
  url: string
  sizeBytes: number
  sha256: string
  /**
   * Memory from which the model runs comfortably: VRAM (GPU, weights + context) or system RAM (CPU).
   * On CPU a 9B model generates a few tokens per second: only the GPU makes it usable.
   */
  minRamGb: number
  minVramGb: number
}

const repoUrl = (size: string, fileName: string) =>
  `https://huggingface.co/unsloth/Qwen3.5-${size}-GGUF/resolve/main/${fileName}`

export const LOCAL_MODELS: readonly LocalModel[] = [
  {
    id: 'qwen3.5-2b',
    level: 'fast',
    name: 'Qwen3.5 2B',
    description: 'Léger et rapide, pour les ordinateurs modestes. Qualité de rédaction correcte.',
    fileName: 'Qwen3.5-2B-Q4_K_M.gguf',
    url: repoUrl('2B', 'Qwen3.5-2B-Q4_K_M.gguf'),
    sizeBytes: 1_280_835_840,
    sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
    minRamGb: 4,
    minVramGb: 3,
  },
  {
    id: 'qwen3.5-4b',
    level: 'balanced',
    name: 'Qwen3.5 4B',
    description: 'Bon compromis vitesse / qualité pour la plupart des ordinateurs récents.',
    fileName: 'Qwen3.5-4B-Q4_K_M.gguf',
    url: repoUrl('4B', 'Qwen3.5-4B-Q4_K_M.gguf'),
    sizeBytes: 2_740_937_888,
    sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
    minRamGb: 8,
    minVramGb: 5,
  },
  {
    id: 'qwen3.5-9b',
    level: 'quality',
    name: 'Qwen3.5 9B',
    description: 'Meilleure qualité, plus lent : pour les machines avec beaucoup de mémoire ou une carte graphique.',
    fileName: 'Qwen3.5-9B-Q4_K_M.gguf',
    url: repoUrl('9B', 'Qwen3.5-9B-Q4_K_M.gguf'),
    sizeBytes: 5_680_522_464,
    sha256: '03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8',
    minRamGb: 64,
    minVramGb: 10,
  },
]

export interface Resources {
  ramGb: number
  vramGb: number
}

export function isModelCompatible(model: LocalModel, { ramGb, vramGb }: Resources): boolean {
  return vramGb >= model.minVramGb || ramGb >= model.minRamGb
}

/** The largest supported model; failing that, the smallest (better slow than nothing). */
export function recommendModel(resources: Resources): LocalModel {
  const compatibleModels = LOCAL_MODELS.filter((m) => isModelCompatible(m, resources))
  const chosen = compatibleModels[compatibleModels.length - 1] ?? LOCAL_MODELS[0]
  if (!chosen) throw new Error('Catalogue de modèles vide')
  return chosen
}
