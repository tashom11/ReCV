import { describe, expect, it } from 'vitest'
import type { Profile } from '../schemas'
import { isEmptyExtraction, sanitizeProfile } from './sanitization'

const CV = `MOREAU Julien
Développeur web / Carrossier peintre
julien.moreau@exemple.fr | 06.00.00.00.01 | Douai
COMPÉTENCES
Rigueur, Autonomie, HTML / CSS, SEO, Permis : B
EXPÉRIENCE PROFESSIONNELLE
DÉVELOPPEUR WEB FRONT
Agence Pixel | 2021-2022
Développement d'interfaces web responsives
CARROSSIER PEINTRE
Carrosserie Dupont | 2016 - 2020
FORMATION
BAC PRO
Lycée Jean Moulin, Douai | 2015
LANGUES
Français, Anglais
Permis : B - Disponibilités : Immédiatement - Site : julien-moreau.exemple.dev`

const base: Profile = {
  fullName: 'Julien Moreau',
  email: 'julien.moreau@exemple.fr',
  phone: '06.00.00.00.01',
  links: [],
  headline: 'Développeur web / Carrossier peintre',
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Agence Pixel',
      dateRange: '2021-2022',
      achievements: ['Développement d’interfaces web responsives'],
    },
    {
      position: 'Carrossier peintre',
      company: 'Carrosserie Dupont',
      dateRange: '2016 - 2020',
      achievements: [],
    },
  ],
  skills: ['Rigueur', 'Autonomie', 'HTML / CSS', 'SEO', 'Permis : B'],
  education: [{ degree: 'BAC PRO', school: 'Lycée Jean Moulin, Douai', dateRange: '2015' }],
  languages: [{ name: 'Français' }, { name: 'Anglais' }],
}

describe('sanitizeProfile', () => {
  it('keeps a profile fully evidenced in the CV', () => {
    expect(sanitizeProfile(base, CV)).toEqual(base)
  })

  it('drops values made only of punctuation (leftovers of a broken JSON answer)', () => {
    const profile: Profile = {
      ...base,
      skills: [...base.skills, '{', '],', '-'],
      languages: [...base.languages, { name: '}' }],
    }
    const cleaned = sanitizeProfile(profile, CV)
    expect(cleaned.skills).toEqual(base.skills)
    expect(cleaned.languages).toEqual(base.languages)
  })

  it('only keeps real web addresses as links, not company names', () => {
    const profile: Profile = {
      ...base,
      links: ['Agence Pixel', 'Carrosserie Dupont', 'julien-moreau.exemple.dev', 'https://github.com/x'],
    }
    expect(sanitizeProfile(profile, CV).links).toEqual(['julien-moreau.exemple.dev', 'https://github.com/x'])
  })

  it('removes a degree wrongly filed among the experiences', () => {
    const profile: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        { position: 'BAC PRO', company: 'Lycée Jean Moulin', dateRange: '2015', achievements: [] },
      ],
    }
    expect(sanitizeProfile(profile, CV).experiences).toEqual(base.experiences)
  })

  it('removes a course filed among the experiences under the school of an education entry', () => {
    const profile: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        { position: 'Formation Bac pro', company: 'Lycée Jean Moulin', dateRange: '2015', achievements: [] },
      ],
    }
    expect(sanitizeProfile(profile, CV).experiences).toEqual(base.experiences)
  })

  it('removes an « experience » made of a miscellaneous line (licence, availability, website)', () => {
    const profile: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          position: '',
          company: '',
          description: 'Permis : B - Disponibilités : Immédiatement - Site : julien-moreau.exemple.dev',
          achievements: [],
        },
      ],
    }
    expect(sanitizeProfile(profile, CV).experiences).toHaveLength(2)
  })

  it('removes an experience with neither company nor dates (position taken from a skill)', () => {
    const profile: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          position: 'Installation et maintenance de matériel informatique.',
          company: '',
          description: 'Support et assistance technique aux utilisateurs.',
          achievements: ['Diagnostic et résolution d’incidents'],
        },
      ],
    }
    expect(sanitizeProfile(profile, CV).experiences.map((e) => e.company)).toEqual([
      'Agence Pixel',
      'Carrosserie Dupont',
    ])
  })

  it('removes an experience whose company or position does not appear in the CV', () => {
    const profile: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        { position: 'Chef de projet', company: 'Société Fantôme', dateRange: '2018', achievements: [] },
      ],
    }
    expect(sanitizeProfile(profile, CV).experiences).toHaveLength(2)
  })

  it('removes made-up education, languages, skills, e-mail and phone', () => {
    const profile: Profile = {
      ...base,
      email: 'inconnu@exemple.fr',
      phone: '07 11 22 33 44',
      education: [...base.education, { degree: 'Master de physique quantique', school: 'MIT' }],
      languages: [...base.languages, { name: 'Japonais' }],
      skills: [...base.skills, 'Kubernetes', 'rigueur'],
    }
    const net = sanitizeProfile(profile, CV)
    expect(net.email).toBeUndefined()
    expect(net.phone).toBeUndefined()
    expect(net.education).toHaveLength(1)
    expect(net.languages.map((l) => l.name)).toEqual(['Français', 'Anglais'])
    expect(net.skills).toEqual(base.skills)
  })

  it('tolerates PDF extraction artefacts (line breaks, hyphens, case, accents)', () => {
    const cvPdf = 'AGENCE\nPIXEL\nDEVELOPPEUR WEB\nFRONT 2021-2022'
    const profile: Profile = {
      links: [],
      experiences: [
        { position: 'Développeur web front', company: 'Agence Pixel', dateRange: '2021-2022', achievements: [] },
      ],
      skills: [],
      education: [],
      languages: [],
    }
    expect(sanitizeProfile(profile, cvPdf).experiences).toHaveLength(1)
  })
})

describe('isEmptyExtraction', () => {
  const identityOnly: Profile = {
    fullName: 'Jeanne Martin',
    links: [],
    experiences: [],
    skills: [],
    education: [],
    languages: [],
  }
  const long = 'x'.repeat(400)

  it('flags a long CV that only gave an identity', () => {
    expect(isEmptyExtraction(identityOnly, long)).toBe(true)
  })

  it('accepts a short text, or a profile with at least one skill, experience or education', () => {
    expect(isEmptyExtraction(identityOnly, 'Jeanne Martin')).toBe(false)
    expect(isEmptyExtraction({ ...identityOnly, skills: ['Rigueur'] }, long)).toBe(false)
    expect(isEmptyExtraction({ ...identityOnly, education: [{ degree: 'BTS', school: 'Lycée' }] }, long)).toBe(false)
  })
})
