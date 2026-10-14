import { z } from 'zod'
import { educationSchema, languageSchema } from './profile'

export const tailoredExperienceSchema = z.object({
  /** Position of the experience in the original profile (order and « before / after » comparison). */
  sourceIndex: z.number().int().nonnegative().optional(),
  position: z.string(),
  company: z.string(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()).default([]),
})
export type TailoredExperience = z.infer<typeof tailoredExperienceSchema>

// Profile items judged unrelated to the job posting: absent from the CV, but offered to the user so they can be
// reinstated. Experiences keep their original achievements there.
export const excludedSchema = z.object({
  experiences: z.array(tailoredExperienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
})
export type Excluded = z.infer<typeof excludedSchema>

// Skills requested by the job posting, compared with the profile. `missing` is NEVER added to the CV automatically:
// the user ticks those they really master.
// Prerequisites quoted by the job posting (education, experience), compared with the profile: information for the user.
export const requirementsSchema = z.object({
  education: z
    .object({
      required: z.string(),
      status: z.enum(['ok', 'insufficient', 'unknown']),
      profileValue: z.string().optional(),
    })
    .optional(),
  experience: z
    .object({
      required: z.string(),
      status: z.enum(['found', 'not-found']),
    })
    .optional(),
})
export type Requirements = z.infer<typeof requirementsSchema>

export const requestedSchema = z.object({
  evidenced: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  requirements: requirementsSchema.default({}),
})
export type Requested = z.infer<typeof requestedSchema>

export const tailoredCvSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  experiences: z.array(tailoredExperienceSchema).default([]),
  /**
   * Skills requested by the job posting that the profile evidences (or that the user declares): at the top of the CV.
   */
  keySkills: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
  languages: z.array(languageSchema).default([]),
  excluded: excludedSchema.default({ experiences: [], skills: [], education: [] }),
  requested: requestedSchema.default({ evidenced: [], missing: [], requirements: {} }),
})
export type TailoredCv = z.infer<typeof tailoredCvSchema>
