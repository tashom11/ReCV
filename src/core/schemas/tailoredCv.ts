import { z } from 'zod'
import { educationSchema, languageSchema } from './profile'

export const tailoredExperienceSchema = z.object({
  /** Position de l'expérience dans le profil d'origine (ordre et mise en regard « avant / après »). */
  sourceIndex: z.number().int().nonnegative().optional(),
  position: z.string(),
  company: z.string(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  bullets: z.array(z.string()).default([]),
})
export type TailoredExperience = z.infer<typeof tailoredExperienceSchema>

// Éléments du profil jugés sans rapport avec l'offre : absents du CV, mais proposés à l'utilisateur
// pour qu'il puisse les réintégrer. Les expériences y gardent leurs réalisations d'origine.
export const excludedSchema = z.object({
  experiences: z.array(tailoredExperienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
})
export type Excluded = z.infer<typeof excludedSchema>

// Compétences demandées par l'offre, rapprochées du profil. `manquantes` n'est JAMAIS ajouté au CV automatiquement :
// l'utilisateur coche celles qu'il maîtrise réellement.
// Prérequis cités par l'offre (formation, expérience), comparés au profil : information pour l'utilisateur.
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
  /** Compétences demandées par l'offre que le profil atteste (ou que l'utilisateur déclare) : en tête du CV. */
  keySkills: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
  languages: z.array(languageSchema).default([]),
  excluded: excludedSchema.default({ experiences: [], skills: [], education: [] }),
  requested: requestedSchema.default({ evidenced: [], missing: [], requirements: {} }),
})
export type TailoredCv = z.infer<typeof tailoredCvSchema>
