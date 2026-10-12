import { z } from 'zod'
import { formationSchema, langueSchema } from './profil'

export const experienceAdapteeSchema = z.object({
  poste: z.string(),
  entreprise: z.string(),
  lieu: z.string().optional(),
  periode: z.string().optional(),
  points: z.array(z.string()).default([]),
})
export type ExperienceAdaptee = z.infer<typeof experienceAdapteeSchema>

export const cvAdapteSchema = z.object({
  titre: z.string(),
  accroche: z.string(),
  experiences: z.array(experienceAdapteeSchema).default([]),
  competences: z.array(z.string()).default([]),
  formations: z.array(formationSchema).default([]),
  langues: z.array(langueSchema).default([]),
})
export type CvAdapte = z.infer<typeof cvAdapteSchema>
