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

// Photo facultative : image réduite, stockée en « data:image/jpeg;base64,… ». Jamais envoyée au modèle de langage.
export const photoSchema = z
  .string()
  .max(300_000)
  .refine((v) => /^data:image\/(png|jpe?g|webp);base64,/i.test(v), 'Photo invalide (PNG, JPEG ou WebP attendu).')

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
  photo: photoSchema.optional(),
})

/** Ce que le modèle extrait d'un CV : la photo n'en fait pas partie (elle est ajoutée par l'utilisateur). */
export const profilExtractionSchema = profilSchema.omit({ photo: true })
export type Profil = z.infer<typeof profilSchema>
