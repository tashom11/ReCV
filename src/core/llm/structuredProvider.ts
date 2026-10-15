import type { JobPosting, Profile, TailoredCv } from '../schemas'
import { analyzeJobPosting, type JobAnalysis } from '../tailoring/jobAnalysis'
import { tailorCv } from '../tailoring/pipeline'
import { generateProfileSummary } from '../tailoring/profileSummary'
import type { LlmEngine } from './engine'
import { extractJobPosting, extractProfile } from './extraction'
import type { LlmProvider, TailoringOptions } from './provider'

// Implementation shared by Ollama, API (BYOK) and local model: only the engine changes.
export class StructuredProvider implements LlmProvider {
  constructor(private readonly engine: LlmEngine) {}

  extractProfile(cvText: string): Promise<Profile> {
    return extractProfile(this.engine, cvText)
  }

  extractJobPosting(jobPostingText: string): Promise<JobPosting> {
    return extractJobPosting(this.engine, jobPostingText)
  }

  analyzeJobPosting(jobPosting: JobPosting): Promise<JobAnalysis> {
    return analyzeJobPosting(this.engine, jobPosting)
  }

  tailorCv(profile: Profile, jobPosting: JobPosting, options?: TailoringOptions): Promise<TailoredCv> {
    return tailorCv(this.engine, profile, jobPosting, options)
  }

  generateSummary(profile: Profile): Promise<string> {
    return generateProfileSummary(this.engine, profile)
  }

  computeMode(): 'gpu' | 'cpu' | null {
    return this.engine.computeMode?.() ?? null
  }

  gpuOffload(): { layers: number; total: number } | null {
    return this.engine.gpuOffload?.() ?? null
  }

  async release(): Promise<void> {
    await this.engine.release?.()
  }
}
