import type { Profile } from '@core/schemas'
import { describe, expect, it } from 'vitest'
import {
  cleanProfile,
  educationSummary,
  experiencesSummary,
  insertAt,
  languagesSummary,
  levelOptions,
  replaceAt,
  skillsSummary,
} from './profileDraft'

const profile: Profile = {
  links: ['linkedin.com/in/x', ' '],
  experiences: [
    { position: 'Assistante RH', company: 'Acme', dateRange: '2020 – 2024', achievements: ['Tri des CV', '', '  '] },
    { position: 'Vendeuse', company: 'Boutique', achievements: [] },
  ],
  skills: ['Rigueur', '', 'Excel '],
  education: [{ degree: 'BTS', school: 'Lycée X', dateRange: '2018' }],
  languages: [{ name: 'Anglais', level: 'B2' }, { name: 'Espagnol' }],
}

describe('profile draft', () => {
  it('removes the empty lines kept while typing, only when saving', () => {
    const cleaned = cleanProfile(profile)
    expect(cleaned.links).toEqual(['linkedin.com/in/x'])
    expect(cleaned.skills).toEqual(['Rigueur', 'Excel'])
    expect(cleaned.experiences[0]?.achievements).toEqual(['Tri des CV'])
  })

  it('summarises each section in one line', () => {
    expect(experiencesSummary(profile.experiences)).toBe('Assistante RH, Acme, 2020 – 2024 · et 1 autre')
    expect(experiencesSummary([])).toBe('Aucune expérience pour l’instant')
    expect(skillsSummary(profile.skills)).toBe('Rigueur, Excel')
    expect(educationSummary(profile.education)).toBe('BTS, Lycée X, 2018')
    expect(languagesSummary(profile.languages)).toBe('Anglais : b2 · Espagnol')
  })

  it('keeps a language level that is not in the CEFR list', () => {
    expect(levelOptions('B2').some((o) => o.value === 'Courant')).toBe(false)
    expect(levelOptions('Courant').at(-1)).toEqual({ value: 'Courant', label: 'Courant' })
  })

  it('replaces one item of a list without touching the others', () => {
    expect(replaceAt(['a', 'b', 'c'], 1, 'B')).toEqual(['a', 'B', 'c'])
  })

  it('puts a removed item back at its place (undo)', () => {
    expect(insertAt(['a', 'c'], 1, 'b')).toEqual(['a', 'b', 'c'])
    expect(insertAt(['a'], 5, 'b')).toEqual(['a', 'b'])
  })
})
