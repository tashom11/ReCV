import type { z } from 'zod'

export interface ObjectRequest<T> {
  /** Step name (logging, error messages, MockEngine replies). */
  name: string
  schema: z.ZodType<T>
  system: string
  user: string
  /** Sampling temperature (default 0.2). 0 for judgement steps, which must be reproducible. */
  temperature?: number
  /**
   * Upper bound of the answer, in tokens. A model sometimes repeats the same items until its context is full (tens of
   * minutes on a modest computer): past this bound, the answer is cut and the step fails or is retried.
   */
  maxTokens?: number
  /** Stops the generation (cancelled by the user). */
  signal?: AbortSignal
}

// Primitive shared by all backends: produce an object validated by a Zod schema.
// Prompts and tailoring steps are written once, on top of this interface.
export interface LlmEngine {
  generateObject<T>(request: ObjectRequest<T>): Promise<T>
  /** Frees native resources, if the engine holds any. */
  release?(): Promise<void>
  /** Where computing runs (local model only); `null` as long as the model is not loaded. */
  computeMode?(): 'gpu' | 'cpu' | null
  /** Layers of the model held by the graphics card out of its total (local model only); `null` until it is loaded. */
  gpuOffload?(): GpuOffload | null
}

export interface GpuOffload {
  layers: number
  total: number
}
