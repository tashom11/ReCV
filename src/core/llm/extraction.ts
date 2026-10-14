import { prepareJobPostingText } from '../job-posting/text'
import { type JobPosting, jobPostingSchema, type Profile, profileExtractionSchema } from '../schemas'
import type { LlmEngine } from './engine'
import { JOB_POSTING_EXTRACTION_PROMPT, PROFILE_EXTRACTION_PROMPT, wrapInTag } from './prompts'
import { sanitizeProfile } from './sanitization'

// Le texte brut est recopié en code : inutile (et risqué) de le faire régénérer par le LLM.
const JOB_POSTING_HEADER_LENGTH = 1500

const extractedJobPostingSchema = jobPostingSchema.omit({ rawText: true })

export async function extractProfile(engine: LlmEngine, cvText: string): Promise<Profile> {
  const extracted = await engine.generateObject({
    name: 'extractProfile',
    schema: profileExtractionSchema,
    system: PROFILE_EXTRACTION_PROMPT,
    user: wrapInTag('cv', cvText),
  })
  // Le modèle peut inventer des entrées : on ne garde que ce qui est attesté dans le texte du CV.
  return sanitizeProfile(extracted, cvText)
}

export async function extractJobPosting(engine: LlmEngine, jobPostingText: string): Promise<JobPosting> {
  const extracted = await engine.generateObject({
    name: 'extractJobPosting',
    schema: extractedJobPostingSchema,
    system: JOB_POSTING_EXTRACTION_PROMPT,
    // Intitulé, entreprise et lieu figurent en tête d'annonce : inutile de faire lire (lentement) tout le texte.
    user: wrapInTag('offre', prepareJobPostingText(jobPostingText, JOB_POSTING_HEADER_LENGTH)),
  })
  return jobPostingSchema.parse({ ...extracted, rawText: jobPostingText })
}
