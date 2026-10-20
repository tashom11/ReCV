import { z } from 'zod'
import type { ExtractionCounts, ProfileCounts } from '../diagnostics'
import { prepareJobPostingText } from '../job-posting/text'
import { completeProfile } from '../parsing/cvReading'
import { type CvSections, detectCvSections } from '../parsing/cvSections'
import {
  educationSchema,
  experienceSchema,
  type JobPosting,
  jobPostingSchema,
  languageSchema,
  type Profile,
  profileExtractionSchema,
} from '../schemas'
import type { LlmEngine } from './engine'
import { JOB_POSTING_EXTRACTION_PROMPT, PROFILE_EXTRACTION_PROMPT, wrapInTag } from './prompts'
import { sanitizeProfile } from './sanitization'

// The raw text is copied in code: no need (and risky) to have the LLM regenerate it.
const JOB_POSTING_HEADER_LENGTH = 1500

const extractedJobPostingSchema = jobPostingSchema.omit({ rawText: true })

const countsOf = (profile: Profile): ProfileCounts => ({
  experiences: profile.experiences.length,
  skills: profile.skills.length,
  education: profile.education.length,
  languages: profile.languages.length,
})

// The profile JSON copies the CV: it is not much longer than the text itself (about 3 characters per token, plus the
// keys). A longer answer is a repetition loop (seen with Qwen3.5 9B repeating the same experiences on a two-column
// CV): it is cut instead of filling the whole context.
const MAX_PROFILE_TOKENS = 6000
export function profileMaxTokens(cvText: string): number {
  return Math.min(MAX_PROFILE_TOKENS, 600 + Math.ceil(cvText.length / 2))
}

// Bounds of the lists of a profile: far above a real CV, they stop a model repeating items (« "", "", "" … ») in
// the grammar itself instead of at the end of the token budget.
const MAX_ITEMS = { links: 10, experiences: 25, education: 15, skills: 80, languages: 12, achievements: 20 }

// The grammar of the local model enforces `min`/`max`; an API without grammar may answer more items or empty
// strings: they are removed before validation.
function boundedArray<T extends z.ZodType>(item: T, min: number, max: number) {
  return z
    .preprocess(
      (value) =>
        Array.isArray(value) ? value.filter((v) => typeof v !== 'string' || v.trim().length >= 2).slice(0, max) : value,
      z.array(item).min(min).max(max),
    )
    .default([])
}

const extractedExperienceSchema = experienceSchema.extend({
  achievements: boundedArray(z.string(), 0, MAX_ITEMS.achievements),
})

// With a JSON grammar, small models answer empty lists whatever the CV contains (Qwen3.5 4B on every CV, 9B
// sometimes). A list whose section was found in the CV text must hold at least one item: the grammar of the local
// model then excludes « [] ». A skill has at least 2 characters, otherwise the model fills the list with « "" ».
// Schemas are built once per combination: the engine caches its grammars by schema.
type ExtractionSchema = z.ZodType<z.output<typeof profileExtractionSchema>>
const extractionSchemas = new Map<string, ExtractionSchema>()
const NO_SECTION: CvSections = { experiences: false, education: false, skills: false, languages: false }

export function profileSchemaFor(sections: CvSections): ExtractionSchema {
  const key = JSON.stringify(sections)
  let schema = extractionSchemas.get(key)
  if (!schema) {
    const min = (found: boolean) => (found ? 1 : 0)
    schema = profileExtractionSchema.extend({
      links: boundedArray(z.string(), 0, MAX_ITEMS.links),
      experiences: boundedArray(extractedExperienceSchema, min(sections.experiences), MAX_ITEMS.experiences),
      education: boundedArray(educationSchema, min(sections.education), MAX_ITEMS.education),
      skills: boundedArray(z.string().min(2), min(sections.skills), MAX_ITEMS.skills),
      languages: boundedArray(languageSchema, min(sections.languages), MAX_ITEMS.languages),
    })
    extractionSchemas.set(key, schema)
  }
  return schema
}

export async function extractProfile(
  engine: LlmEngine,
  cvText: string,
  onCounts?: (counts: ExtractionCounts) => void,
): Promise<Profile> {
  const request = {
    name: 'extractProfile',
    system: PROFILE_EXTRACTION_PROMPT,
    user: wrapInTag('cv', cvText),
    maxTokens: profileMaxTokens(cvText),
  }
  const constrained = profileSchemaFor(detectCvSections(cvText))
  let extracted: Profile
  try {
    extracted = await engine.generateObject({ ...request, schema: constrained })
  } catch (error) {
    // A model that still answers an empty list (API without a grammar) must not make the import fail: the step is
    // run again without the constraint.
    const unconstrained = profileSchemaFor(NO_SECTION)
    if (constrained === unconstrained) throw error
    extracted = await engine.generateObject({ ...request, schema: unconstrained })
  }
  // The model may make up entries: only what is evidenced in the CV text is kept.
  // What the model read badly or left out (skills, languages, bullets) is completed from the CV text.
  const kept = completeProfile(sanitizeProfile(extracted, cvText), cvText)
  // Numbers only: tells a model that read little from a filter that removed too much, without any CV content.
  onCounts?.({ textLength: cvText.length, raw: countsOf(extracted), kept: countsOf(kept) })
  return kept
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
