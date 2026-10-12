import { z } from 'zod'

export const offreSchema = z.object({
  titrePoste: z.string(),
  entreprise: z.string().optional(),
  lieu: z.string().optional(),
  texteBrut: z.string(),
})
export type Offre = z.infer<typeof offreSchema>
