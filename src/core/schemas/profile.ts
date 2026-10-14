import { z } from 'zod'

export const experienceSchema = z.object({
  position: z.string(),
  company: z.string(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  description: z.string().optional(),
  achievements: z.array(z.string()).default([]),
})
export type Experience = z.infer<typeof experienceSchema>

export const educationSchema = z.object({
  degree: z.string(),
  school: z.string(),
  location: z.string().optional(),
  dateRange: z.string().optional(),
  description: z.string().optional(),
})
export type Education = z.infer<typeof educationSchema>

export const languageSchema = z.object({
  name: z.string(),
  level: z.string().optional(),
})
export type Language = z.infer<typeof languageSchema>

// Optional photo: reduced image, stored as « data:image/jpeg;base64,… ». Never sent to the language model.
export const photoSchema = z
  .string()
  .max(300_000)
  .refine((v) => /^data:image\/(png|jpe?g|webp);base64,/i.test(v), 'Photo invalide (PNG, JPEG ou WebP attendu).')

export const profileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  links: z.array(z.string()).default([]),
  headline: z.string().optional(),
  summary: z.string().optional(),
  experiences: z.array(experienceSchema).default([]),
  skills: z.array(z.string()).default([]),
  education: z.array(educationSchema).default([]),
  languages: z.array(languageSchema).default([]),
  photo: photoSchema.optional(),
})

/** What the model extracts from a CV: the photo is not part of it (the user adds it). */
export const profileExtractionSchema = profileSchema.omit({ photo: true })
export type Profile = z.infer<typeof profileSchema>
