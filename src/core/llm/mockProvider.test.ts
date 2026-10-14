import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { jobPostingSchema, profileSchema, tailoredCvSchema } from '../schemas'
import { MockProvider } from './mockProvider'

const cvText = readFileSync(resolve(import.meta.dirname, '../../../fixtures/cv-exemple.txt'), 'utf-8')
const jobPostingText = readFileSync(resolve(import.meta.dirname, '../../../fixtures/offre-exemple.txt'), 'utf-8')

describe('FournisseurMock', () => {
  it('extraireProfil renvoie un Profil valide', async () => {
    const provider = new MockProvider()
    const profile = await provider.extractProfile(cvText)
    expect(() => profileSchema.parse(profile)).not.toThrow()
    expect(profile.experiences.length).toBeGreaterThan(0)
  })

  it('extraireOffre renvoie une Offre valide dont le texte brut est fidèle à l’entrée', async () => {
    const provider = new MockProvider()
    const jobPosting = await provider.extractJobPosting(jobPostingText)
    expect(() => jobPostingSchema.parse(jobPosting)).not.toThrow()
    expect(jobPosting.rawText).toBe(jobPostingText)
  })

  it('adapterCv renvoie un CvAdapte valide construit à partir du profil fourni', async () => {
    const provider = new MockProvider()
    const profile = await provider.extractProfile(cvText)
    const jobPosting = await provider.extractJobPosting(jobPostingText)
    const tailoredCv = await provider.tailorCv(profile, jobPosting)
    expect(() => tailoredCvSchema.parse(tailoredCv)).not.toThrow()
    expect(tailoredCv.experiences).toHaveLength(profile.experiences.length)
    expect(tailoredCv.skills).toEqual(profile.skills)
  })
})
