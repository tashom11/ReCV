import { jobPostingSchema, profileSchema, tailoredCvSchema } from '@core/schemas'
import { describe, expect, it } from 'vitest'
import { jobPostingFromV1, profileFromV1, tailoredCvFromV1 } from './legacyData'

// Data exactly as v0.2.1 stored it (French keys).
const PROFIL_V1 = {
  nom: 'Camille Martin',
  email: 'camille@exemple.fr',
  telephone: '06 12 34 56 78',
  adresse: 'Lyon',
  liensProfessionnels: ['linkedin.com/in/camille'],
  titrePoste: 'Chargée de recrutement',
  accroche: 'Rigoureuse et organisée.',
  experiences: [
    {
      poste: 'Assistante RH',
      entreprise: 'Acme',
      lieu: 'Lyon',
      periode: '2020 – 2024',
      description: 'RH',
      realisations: ['Tri des CV'],
    },
  ],
  competences: ['Rigueur'],
  formations: [{ diplome: 'BTS', etablissement: 'Lycée X', lieu: 'Lyon', periode: '2018', description: 'Option RH' }],
  langues: [{ nom: 'Anglais', niveau: 'B2' }],
  photo: 'data:image/jpeg;base64,AAAA',
}

const CV_V1 = {
  titre: 'Chargée de recrutement',
  accroche: 'Je mets en avant ma rigueur.',
  experiences: [
    {
      indice: 0,
      poste: 'Assistante RH',
      entreprise: 'Acme',
      lieu: 'Lyon',
      periode: '2020 – 2024',
      points: ['Tri des CV'],
    },
  ],
  competencesCles: ['Sourcing'],
  competences: ['Rigueur'],
  formations: [{ diplome: 'BTS', etablissement: 'Lycée X' }],
  langues: [{ nom: 'Anglais', niveau: 'B2' }],
  ecartes: {
    experiences: [{ indice: 1, poste: 'Vendeuse', entreprise: 'Boutique', points: ['Caisse'] }],
    competences: ['Couture'],
    formations: [{ diplome: 'CAP', etablissement: 'Lycée Y' }],
  },
  demandees: {
    attestees: ['Rigueur'],
    manquantes: ['Excel'],
    prerequis: {
      formation: { exigee: 'Bac +3', statut: 'insuffisante', profil: 'BTS' },
      experience: { exigee: '2 ans', statut: 'non-retrouvee' },
    },
  },
}

describe('v0.2.1 data → English keys', () => {
  it('converts a profile without losing anything', () => {
    expect(profileSchema.parse(profileFromV1(PROFIL_V1))).toEqual({
      fullName: 'Camille Martin',
      email: 'camille@exemple.fr',
      phone: '06 12 34 56 78',
      location: 'Lyon',
      links: ['linkedin.com/in/camille'],
      headline: 'Chargée de recrutement',
      summary: 'Rigoureuse et organisée.',
      experiences: [
        {
          position: 'Assistante RH',
          company: 'Acme',
          location: 'Lyon',
          dateRange: '2020 – 2024',
          description: 'RH',
          achievements: ['Tri des CV'],
        },
      ],
      skills: ['Rigueur'],
      education: [{ degree: 'BTS', school: 'Lycée X', location: 'Lyon', dateRange: '2018', description: 'Option RH' }],
      languages: [{ name: 'Anglais', level: 'B2' }],
      photo: 'data:image/jpeg;base64,AAAA',
    })
  })

  it('converts a job posting', () => {
    const v1 = { titrePoste: 'Développeur', entreprise: 'Acme', lieu: 'Lille', texteBrut: 'Texte' }
    expect(jobPostingSchema.parse(jobPostingFromV1(v1))).toEqual({
      jobTitle: 'Développeur',
      company: 'Acme',
      location: 'Lille',
      rawText: 'Texte',
    })
  })

  it('converts a tailored CV, nested parts and status values included', () => {
    expect(tailoredCvSchema.parse(tailoredCvFromV1(CV_V1))).toEqual({
      headline: 'Chargée de recrutement',
      summary: 'Je mets en avant ma rigueur.',
      experiences: [
        {
          sourceIndex: 0,
          position: 'Assistante RH',
          company: 'Acme',
          location: 'Lyon',
          dateRange: '2020 – 2024',
          bullets: ['Tri des CV'],
        },
      ],
      keySkills: ['Sourcing'],
      skills: ['Rigueur'],
      education: [{ degree: 'BTS', school: 'Lycée X' }],
      languages: [{ name: 'Anglais', level: 'B2' }],
      excluded: {
        experiences: [{ sourceIndex: 1, position: 'Vendeuse', company: 'Boutique', bullets: ['Caisse'] }],
        skills: ['Couture'],
        education: [{ degree: 'CAP', school: 'Lycée Y' }],
      },
      requested: {
        evidenced: ['Rigueur'],
        missing: ['Excel'],
        requirements: {
          education: { required: 'Bac +3', status: 'insufficient', profileValue: 'BTS' },
          experience: { required: '2 ans', status: 'not-found' },
        },
      },
    })
  })

  it('converts an older tailored CV that had no requested skills nor excluded items', () => {
    const ancien = { titre: 'T', accroche: 'A', experiences: [], competences: [] }
    expect(tailoredCvSchema.parse(tailoredCvFromV1(ancien))).toMatchObject({ headline: 'T', summary: 'A' })
  })

  it('leaves data that is already converted unchanged', () => {
    const converti = profileFromV1(PROFIL_V1)
    expect(profileFromV1(converti)).toEqual(converti)
  })
})
