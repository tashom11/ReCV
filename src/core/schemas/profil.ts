import { z } from 'zod'

export const experienceSchema = z.object({
  poste: z.string(),
  entreprise: z.string(),
  lieu: z.string().optional(),
  periode: z.string().optional(),
  description: z.string().optional(),
  realisations: z.array(z.string()).default([]),
})
export type Experience = z.infer<typeof experienceSchema>

export const formationSchema = z.object({
  diplome: z.string(),
  etablissement: z.string(),
  lieu: z.string().optional(),
  periode: z.string().optional(),
  description: z.string().optional(),
})
export type Formation = z.infer<typeof formationSchema>

export const langueSchema = z.object({
  nom: z.string(),
  niveau: z.string().optional(),
})
export type Langue = z.infer<typeof langueSchema>

export const profilSchema = z.object({
  nom: z.string().optional(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  liensProfessionnels: z.array(z.string()).default([]),
  titrePoste: z.string().optional(),
  accroche: z.string().optional(),
  experiences: z.array(experienceSchema).default([]),
  competences: z.array(z.string()).default([]),
  formations: z.array(formationSchema).default([]),
  langues: z.array(langueSchema).default([]),
})
export type Profil = z.infer<typeof profilSchema>
