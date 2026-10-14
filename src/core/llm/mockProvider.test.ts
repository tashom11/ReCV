import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { jobPostingSchema, profileSchema, tailoredCvSchema } from '../schemas'
import { MockProvider } from './mockProvider'

const cvText = readFileSync(resolve(import.meta.dirname, '../../../fixtures/cv-exemple.txt'), 'utf-8')
const jobPostingText = readFileSync(resolve(import.meta.dirname, '../../../fixtures/offre-exemple.txt'), 'utf-8')

describe('MockProvider', () => {
  it('extractProfile returns a valid Profile', async () => {
    const provider = new MockProvider()
    const profile = await provider.extractProfile(cvText)
    expect(() => profileSchema.parse(profile)).not.toThrow()
    expect(profile.experiences.length).toBeGreaterThan(0)
  })

  it('extractJobPosting returns a valid JobPosting whose raw text matches the input', async () => {
    const provider = new MockProvider()
    const jobPosting = await provider.extractJobPosting(jobPostingText)
    expect(() => jobPostingSchema.parse(jobPosting)).not.toThrow()
    expect(jobPosting.rawText).toBe(jobPostingText)
  })

  it('tailorCv returns a valid TailoredCv built from the given profile', async () => {
    const provider = new MockProvider()
    const profile = await provider.extractProfile(cvText)
    const jobPosting = await provider.extractJobPosting(jobPostingText)
    const tailoredCv = await provider.tailorCv(profile, jobPosting)
    expect(() => tailoredCvSchema.parse(tailoredCv)).not.toThrow()
    expect(tailoredCv.experiences).toHaveLength(profile.experiences.length)
    expect(tailoredCv.skills).toEqual(profile.skills)
  })
})
