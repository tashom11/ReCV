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

describe('generateProfileSummary', () => {
  it("returns the model's summary when it only quotes transferable skills", async () => {
    const summary = 'Je fais preuve de rigueur et d’autonomie, avec un bon sens de l’organisation.'
    const m = engine({ transferableSkills: ['Rigueur', 'Autonomie', 'Organisation'], summary })
    expect(await generateProfileSummary(m, profile)).toBe(summary)
  })

  it('passes neither position nor employer to the model', async () => {
    const m = engine({ transferableSkills: ['Rigueur'], summary: 'Je fais preuve de rigueur.' })
    await generateProfileSummary(m, profile)
    expect(m.requests[0]?.user).not.toMatch(/Webagence|Développeur web front/)
  })

  it('rejects a summary quoting a job-specific tool, and falls back to the kept skills', async () => {
    const m = engine({
      transferableSkills: ['Rigueur', 'Autonomie'],
      summary: 'Je fais preuve de rigueur et je maîtrise HTML / CSS.',
    })
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur et d’autonomie.')
  })

  it('rejects a summary containing a figure or an employer', async () => {
    for (const summary of ['Je fais preuve de rigueur depuis 4 ans.', 'Je fais preuve de rigueur, ancien de Webagence.']) {
      const m = engine({ transferableSkills: ['Rigueur'], summary })
      expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur.')
    }
  })

  it('only accepts skills present word for word in the profile', async () => {
    const m = engine({
      transferableSkills: ['Rigueur', 'Leadership', 'Esprit visionnaire'],
      summary: 'Je fais preuve de leadership visionnaire.',
    })
    // « Leadership » and « Esprit visionnaire » are not in the profile: only « Rigueur » is kept.
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de rigueur.')
  })

  it('recognises a transferable skill evidenced in the achievements', async () => {
    const m = engine({
      transferableSkills: ['respect des délais'],
      summary: 'Je fais preuve de respect des délais.',
    })
    expect(await generateProfileSummary(m, profile)).toBe('Je fais preuve de respect des délais.')
  })

  it('clearly reports the absence of transferable skills', async () => {
    const m = engine({ transferableSkills: ['Leadership'], summary: 'Leader inspirant et visionnaire.' })
    await expect(generateProfileSummary(m, profile)).rejects.toThrow(NO_SKILL_MESSAGE)
  })
})

describe('unsupportedWords', () => {
  const source = 'Rigueur, Autonomie, Organisation, Communication claire, Travail en équipe'

  it('accepts morphological variants of the profile qualities', () => {
    expect(unsupportedWords('Je suis rigoureux et autonome, avec le sens de l’organisation.', source)).toEqual([])
  })

  it('reports the qualities absent from the profile', () => {
    expect(unsupportedWords('Leader visionnaire et créatif.', source)).toEqual(['leader', 'visionnaire', 'creatif'])
  })
})

describe('generateProfileSummary: first person', () => {
  const m = (summary: string) =>
    new MockEngine({ profileSummary: { transferableSkills: ['Rigueur', 'Autonomie'], summary } })

  it('rejects a summary in the third person or without subject', async () => {
    for (const summary of [
      'Il fait preuve de rigueur et d’autonomie.',
      'Le candidat fait preuve de rigueur.',
      'Rigoureux et autonome, sait organiser son travail.',
    ]) {
      expect(await generateProfileSummary(m(summary), profile)).toBe('Je fais preuve de rigueur et d’autonomie.')
    }
  })

  it('accepts « Je » and « J’ »', async () => {
    const withJe = 'J’ai le sens de la rigueur et de l’autonomie.'
    expect(await generateProfileSummary(m(withJe), profile)).toBe(withJe)
  })

  it('the fallback is in the first person, with correct elision', async () => {
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
