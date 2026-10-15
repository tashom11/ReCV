import type { ExtractionCounts } from '../diagnostics'
import type { JobPosting, Profile, TailoredCv } from '../schemas'
import type { StepKey } from '../steps'
import type { JobAnalysis } from '../tailoring/jobAnalysis'

/** Step of a long task, to display progress. */
export interface TailoringStep {
  key?: StepKey
  current?: number
  total?: number
}

export interface TailoringOptions {
  onStep?: (step: TailoringStep) => void
  /** Rewrite the bullets with the model (slow). Default: original bullets are selected, without the model. */
  rewrite?: boolean
  /** Job posting analysis already known (it does not depend on the profile): avoids calling the model. */
  analysis?: JobAnalysis
  /** Receives the computed analysis, to keep it. */
  onAnalysis?: (analysis: JobAnalysis) => void
  /** Cancellation: checked between steps and passed to the engine. */
  signal?: AbortSignal
}

export interface LlmProvider {
  extractProfile(cvText: string, onCounts?: (counts: ExtractionCounts) => void): Promise<Profile>
  extractJobPosting(jobPostingText: string): Promise<JobPosting>
  /** Requirements of the job posting (skills, qualities, prerequisites): first tailoring step, reusable. */
  analyzeJobPosting(jobPosting: JobPosting): Promise<JobAnalysis>
  tailorCv(profile: Profile, jobPosting: JobPosting, options?: TailoringOptions): Promise<TailoredCv>
  /** Generic profile summary, based only on its transferable skills (soft skills). */
  generateSummary(profile: Profile): Promise<string>
  /** Where computing runs (local model only). */
  computeMode?(): 'gpu' | 'cpu' | null
  /** Layers of the model on the graphics card out of its total (local model only). */
  gpuOffload?(): { layers: number; total: number } | null
  /** Frees native resources (local model); absent for remote providers. */
  release?(): Promise<void>
}

export type { StepKey } from '../steps'
