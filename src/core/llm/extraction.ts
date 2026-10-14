import { prepareJobPostingText } from '../job-posting/text'
import { type JobPosting, jobPostingSchema, type Profile, profileExtractionSchema } from '../schemas'
import type { LlmEngine } from './engine'
import { JOB_POSTING_EXTRACTION_PROMPT, PROFILE_EXTRACTION_PROMPT, wrapInTag } from './prompts'
import { sanitizeProfile } from './sanitization'

// The raw text is copied in code: no need (and risky) to have the LLM regenerate it.
const JOB_POSTING_HEADER_LENGTH = 1500

const extractedJobPostingSchema = jobPostingSchema.omit({ rawText: true })

export async function extractProfile(engine: LlmEngine, cvText: string): Promise<Profile> {
  const extracted = await engine.generateObject({
    name: 'extractProfile',
    schema: profileExtractionSchema,
    system: PROFILE_EXTRACTION_PROMPT,
    user: wrapInTag('cv', cvText),
  })
  // The model may make up entries: only what is evidenced in the CV text is kept.
  return sanitizeProfile(extracted, cvText)
}

export async function extractJobPosting(engine: LlmEngine, jobPostingText: string): Promise<JobPosting> {
  const extracted = await engine.generateObject({
    name: 'extractJobPosting',
    schema: extractedJobPostingSchema,
    system: JOB_POSTING_EXTRACTION_PROMPT,
    // Title, company and location are at the top of the posting: no need to have the whole text read (slowly).
    user: wrapInTag('offre', prepareJobPostingText(jobPostingText, JOB_POSTING_HEADER_LENGTH)),
  })
  return jobPostingSchema.parse({ ...extracted, rawText: jobPostingText })
}
