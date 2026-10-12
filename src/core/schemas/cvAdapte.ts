import { z } from 'zod'
import { formationSchema, langueSchema } from './profil'

export const experienceAdapteeSchema = z.object({
  /** Position de l'expérience dans le profil d'origine (ordre et mise en regard « avant / après »). */
  indice: z.number().int().nonnegative().optional(),
  poste: z.string(),
  entreprise: z.string(),
  lieu: z.string().optional(),
  periode: z.string().optional(),
  points: z.array(z.string()).default([]),
})
export type ExperienceAdaptee = z.infer<typeof experienceAdapteeSchema>

// Éléments du profil jugés sans rapport avec l'offre : absents du CV, mais proposés à l'utilisateur
// pour qu'il puisse les réintégrer. Les expériences y gardent leurs réalisations d'origine.
export const ecartesSchema = z.object({
  experiences: z.array(experienceAdapteeSchema).default([]),
  competences: z.array(z.string()).default([]),
  formations: z.array(formationSchema).default([]),
})
export type Ecartes = z.infer<typeof ecartesSchema>

export const cvAdapteSchema = z.object({
  titre: z.string(),
  accroche: z.string(),
  experiences: z.array(experienceAdapteeSchema).default([]),
  competences: z.array(z.string()).default([]),
  formations: z.array(formationSchema).default([]),
  langues: z.array(langueSchema).default([]),
  ecartes: ecartesSchema.default({ experiences: [], competences: [], formations: [] }),
})
export type CvAdapte = z.infer<typeof cvAdapteSchema>
