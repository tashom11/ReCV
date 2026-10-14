import { describe, expect, it } from 'vitest'
import { MockEngine } from '../llm/mockEngine'
import type { Profile } from '../schemas'
import { generateProfileSummary, NO_SKILL_MESSAGE, unsupportedWords } from './profileSummary'

const profile: Profile = {
  headline: 'Développeur web / Carrossier peintre',
  summary: 'Expérience de 4 ans en développement web.',
  links: [],
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Webagence',
      achievements: ['Collaborer avec les équipes design et back-end', 'Respect des délais'],
    },
  ],
  skills: ['Rigueur', 'Autonomie', 'Organisation', 'HTML / CSS', 'WordPress / CMS'],
  education: [],
  languages: [],
}

const engine = (response: { transferableSkills: string[]; summary: string }) =>
  new MockEngine({ profileSummary: response })

describe('genererAccrocheProfil', () => {
  it('retourne l’accroche du modèle quand elle ne cite que des compétences transversales', async () => {
    const summary = 'Je fais preuve de rigueur et d’autonomie, avec un bon sens de l’organisation.'
    const m = engine({ transferableSkills: ['Rigueur', 'Autonomie', 'Organisation'], summary })
    expect(await generateProfileSummary(m, profile)).toBe(summary)
  })

  it('ne transmet au modèle ni poste ni employeur', async () => {
    const m = engine({ transferableSkills: ['Rigueur'], summary: 'Je fais preuve de rigueur.' })
    await generateProfileSummary(m, profile)
    expect(m.requests[0]?.user).not.toMatch(/Webagence|Développeur web front/)
  })

  it('rejette une accroche qui cite un outil de métier, et se replie sur les compétences retenues', async () => {
    const m = engine({
      transferableSkills: ['Rigueur', 'Autonomie'],
      summary: 'Je fais preuve de rigueur et je maîtrise HTML / CSS.',
    })
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur et d’autonomie.')
  })

  it('rejette une accroche contenant un chiffre ou un employeur', async () => {
    for (const summary of ['Je fais preuve de rigueur depuis 4 ans.', 'Je fais preuve de rigueur, ancien de Webagence.']) {
      const m = engine({ transferableSkills: ['Rigueur'], summary })
      expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur.')
    }
  })

  it('n’accepte que des compétences présentes mot pour mot dans le profil', async () => {
    const m = engine({
      transferableSkills: ['Rigueur', 'Leadership', 'Esprit visionnaire'],
      summary: 'Je fais preuve de leadership visionnaire.',
    })
    // « Leadership » et « Esprit visionnaire » ne figurent pas dans le profil : seule « Rigueur » est retenue.
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur.')
  })

  it('reconnaît une compétence transversale attestée dans les réalisations', async () => {
    const m = engine({
      transferableSkills: ['respect des délais'],
      summary: 'Je fais preuve de respect des délais.',
    })
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de respect des délais.')
  })

  it('signale clairement l’absence de compétence transversale', async () => {
    const m = engine({ transferableSkills: ['Leadership'], summary: 'Leader inspirant et visionnaire.' })
    await expect(generateProfileSummary(m, profile)).rejects.toThrow(NO_SKILL_MESSAGE)
  })
})

describe('motsNonAttestes', () => {
  const source = 'Rigueur, Autonomie, Organisation, Communication claire, Travail en équipe'

  it('accepte les variantes morphologiques de qualités du profil', () => {
    expect(unsupportedWords('Je suis rigoureux et autonome, avec le sens de l’organisation.', source)).toEqual([])
  })

  it('signale les qualités absentes du profil', () => {
    expect(unsupportedWords('Leader visionnaire et créatif.', source)).toEqual(['leader', 'visionnaire', 'creatif'])
  })
})

describe('genererAccrocheProfil : première personne', () => {
  const m = (summary: string) =>
    new MockEngine({ profileSummary: { transferableSkills: ['Rigueur', 'Autonomie'], summary } })

  it('rejette une accroche à la troisième personne ou sans sujet', async () => {
    for (const summary of [
      'Il fait preuve de rigueur et d’autonomie.',
      'Le candidat fait preuve de rigueur.',
      'Rigoureux et autonome, sait organiser son travail.',
    ]) {
      expect(await generateProfileSummary(m(summary), profile)).toBe('Je fais preuve de rigueur et d’autonomie.')
    }
  })

  it('accepte « Je » et « J’ »', async () => {
    const withJe = 'J’ai le sens de la rigueur et de l’autonomie.'
    expect(await generateProfileSummary(m(withJe), profile)).toBe(withJe)
  })

  it('le repli est à la première personne, avec élision correcte', async () => {
    const rep = await generateProfileSummary(
      new MockEngine({
        profileSummary: {
          transferableSkills: ['Organisation', 'Rigueur', 'Autonomie'],
          summary: 'xxxxxxxxxxxxxxxxxxxx',
        },
      }),
      profile,
    )
    expect(rep).toBe('Je fais preuve d’organisation, de rigueur et d’autonomie.')
  })
})
