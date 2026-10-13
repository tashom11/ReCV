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

// Compétences demandées par l'offre, rapprochées du profil. `manquantes` n'est JAMAIS ajouté au CV automatiquement :
// l'utilisateur coche celles qu'il maîtrise réellement.
// Prérequis cités par l'offre (formation, expérience), comparés au profil : information pour l'utilisateur.
export const prerequisSchema = z.object({
  formation: z
    .object({
      exigee: z.string(),
      statut: z.enum(['ok', 'insuffisante', 'inconnue']),
      profil: z.string().optional(),
    })
    .optional(),
  experience: z
    .object({
      exigee: z.string(),
      statut: z.enum(['retrouvee', 'non-retrouvee']),
    })
    .optional(),
})
export type Prerequis = z.infer<typeof prerequisSchema>

export const demandeesSchema = z.object({
  attestees: z.array(z.string()).default([]),
  manquantes: z.array(z.string()).default([]),
  prerequis: prerequisSchema.default({}),
})
export type Demandees = z.infer<typeof demandeesSchema>

export const cvAdapteSchema = z.object({
  titre: z.string(),
  accroche: z.string(),
  experiences: z.array(experienceAdapteeSchema).default([]),
  /** Compétences demandées par l'offre que le profil atteste (ou que l'utilisateur déclare) : en tête du CV. */
  competencesCles: z.array(z.string()).default([]),
  competences: z.array(z.string()).default([]),
  formations: z.array(formationSchema).default([]),
  langues: z.array(langueSchema).default([]),
  ecartes: ecartesSchema.default({ experiences: [], competences: [], formations: [] }),
  demandees: demandeesSchema.default({ attestees: [], manquantes: [], prerequis: {} }),
})
export type CvAdapte = z.infer<typeof cvAdapteSchema>
