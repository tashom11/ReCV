import { z } from 'zod'

export const jobPostingSchema = z.object({
  jobTitle: z.string(),
  company: z.string().optional(),
  location: z.string().optional(),
  rawText: z.string(),
})
export type JobPosting = z.infer<typeof jobPostingSchema>
