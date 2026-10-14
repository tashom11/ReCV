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
  it('accepte une expérience minimale valide', () => {
    expect(() => experienceSchema.parse({ position: 'Développeur', company: 'Acme' })).not.toThrow()
  })

  it('rejette une expérience sans poste', () => {
    expect(() => experienceSchema.parse({ company: 'Acme' })).toThrow()
  })
})

describe('formationSchema', () => {
  it('accepte une formation minimale valide', () => {
    expect(() => educationSchema.parse({ degree: 'Master', school: 'Université X' })).not.toThrow()
  })

  it('rejette une formation sans établissement', () => {
    expect(() => educationSchema.parse({ degree: 'Master' })).toThrow()
  })
})

describe('langueSchema', () => {
  it('accepte une langue minimale valide', () => {
    expect(() => languageSchema.parse({ name: 'Français' })).not.toThrow()
  })

  it('rejette une langue sans nom', () => {
    expect(() => languageSchema.parse({ level: 'Courant' })).toThrow()
  })
})

describe('profilSchema', () => {
  it('accepte un profil vide et applique les valeurs par défaut', () => {
    const profile = profileSchema.parse({})
    expect(profile.experiences).toEqual([])
    expect(profile.skills).toEqual([])
    expect(profile.education).toEqual([])
    expect(profile.languages).toEqual([])
  })

  it('rejette un profil avec une expérience invalide', () => {
    expect(() => profileSchema.parse({ experiences: [{ position: 'Développeur' }] })).toThrow()
  })
})

describe('offreSchema', () => {
  it('accepte une offre minimale valide', () => {
    expect(() => jobPostingSchema.parse({ jobTitle: 'Développeur', rawText: 'Texte de l’offre' })).not.toThrow()
  })

  it('rejette une offre sans texteBrut', () => {
    expect(() => jobPostingSchema.parse({ jobTitle: 'Développeur' })).toThrow()
  })
})

describe('cvAdapteSchema', () => {
  it('accepte un CV adapté minimal valide', () => {
    expect(() => tailoredCvSchema.parse({ headline: 'Développeur', summary: 'Accroche' })).not.toThrow()
  })

  it('rejette un CV adapté sans titre', () => {
    expect(() => tailoredCvSchema.parse({ summary: 'Accroche' })).toThrow()
  })
})
