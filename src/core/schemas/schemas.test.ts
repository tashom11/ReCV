import { describe, expect, it } from 'vitest'
import {
  educationSchema,
  experienceSchema,
  jobPostingSchema,
  languageSchema,
  profileSchema,
  tailoredCvSchema,
} from './index'

describe('experienceSchema', () => {
  it('accepts a minimal valid experience', () => {
    expect(() => experienceSchema.parse({ position: 'Développeur', company: 'Acme' })).not.toThrow()
  })

  it('rejects an experience without position', () => {
    expect(() => experienceSchema.parse({ company: 'Acme' })).toThrow()
  })
})

describe('educationSchema', () => {
  it('accepts a minimal valid education entry', () => {
    expect(() => educationSchema.parse({ degree: 'Master', school: 'Université X' })).not.toThrow()
  })

  it('rejects an education entry without school', () => {
    expect(() => educationSchema.parse({ degree: 'Master' })).toThrow()
  })
})

describe('languageSchema', () => {
  it('accepts a minimal valid language', () => {
    expect(() => languageSchema.parse({ name: 'Français' })).not.toThrow()
  })

  it('rejects a language without name', () => {
    expect(() => languageSchema.parse({ level: 'Courant' })).toThrow()
  })
})

describe('profileSchema', () => {
  it('accepts an empty profile and applies the defaults', () => {
    const profile = profileSchema.parse({})
    expect(profile.experiences).toEqual([])
    expect(profile.skills).toEqual([])
    expect(profile.education).toEqual([])
    expect(profile.languages).toEqual([])
  })

  it('rejects a profile with an invalid experience', () => {
    expect(() => profileSchema.parse({ experiences: [{ position: 'Développeur' }] })).toThrow()
  })
})

describe('jobPostingSchema', () => {
  it('accepts a minimal valid job posting', () => {
    expect(() => jobPostingSchema.parse({ jobTitle: 'Développeur', rawText: 'Texte de l’offre' })).not.toThrow()
  })

  it('rejects a job posting without rawText', () => {
    expect(() => jobPostingSchema.parse({ jobTitle: 'Développeur' })).toThrow()
  })
})

describe('tailoredCvSchema', () => {
  it('accepts a minimal valid tailored CV', () => {
    expect(() => tailoredCvSchema.parse({ headline: 'Développeur', summary: 'Accroche' })).not.toThrow()
  })

  it('rejects a tailored CV without headline', () => {
    expect(() => tailoredCvSchema.parse({ summary: 'Accroche' })).toThrow()
  })
})
