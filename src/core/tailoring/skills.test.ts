import { describe, expect, it } from 'vitest'
import { buildCvDocument } from '../export/cvDocument'
import { MockEngine } from '../llm/mockEngine'
import { sanitizeProfile } from '../llm/sanitization'
import type { JobPosting, Profile } from '../schemas'
import { tailoredCvSchema } from '../schemas'
import { tailorCv } from './pipeline'
import {
  formatSkill,
  isShortSkill,
  isSoftSkill,
  softSkillsSentence,
  splitSkills,
  splitSoftAndHardSkills,
} from './skills'

describe('isShortSkill', () => {
  it('accepts terms, refuses activity sentences', () => {
    for (const ok of [
      'Rigueur',
      'WordPress / CMS',
      'Gestion & créa. de landing pages',
      'Capacité d’apprentissage rapide',
    ]) {
      expect(isShortSkill(ok)).toBe(true)
    }
    for (const sentence of [
      'Installation et maintenance de matériel informatique',
      'Support et assistance technique aux utilisateurs',
      'Collaboration avec l’équipe design pour transformer des maquettes en sites web interactifs et responsives',
      'Tests, correction de bugs et optimisation des performances.',
    ]) {
      expect(isShortSkill(sentence)).toBe(false)
    }
  })
})

describe('soft skills and formatting', () => {
  it('recognises transferable qualities, typographic apostrophe included', () => {
    for (const c of [
      'Rigueur',
      'Autonomie',
      'Travail en équipe',
      'Sens du détail',
      'Capacité d’apprentissage rapide',
      'Esprit d’équipe',
    ]) {
      expect(isSoftSkill(c)).toBe(true)
    }
    for (const c of ['WordPress / CMS', 'HTML / CSS', 'Google Tag Manager', 'Permis : B']) {
      expect(isSoftSkill(c)).toBe(false)
    }
    expect(splitSoftAndHardSkills(['Rigueur', 'SEO', 'Autonomie'])).toEqual({
      softSkills: ['Rigueur', 'Autonomie'],
      hardSkills: ['SEO'],
    })
  })

  it('capitalises the first letter and splits lists of short terms', () => {
    expect(formatSkill('  création   digitale ')).toBe('Création digitale')
    expect(splitSkills(['SEO, RGAA, LLM, CRM'])).toEqual(['SEO', 'RGAA', 'LLM', 'CRM'])
    // Items too long to be terms: the list is kept as it is (then filtered as a sentence).
    const tooLong = 'Création de contenus éditoriaux et multimédias, supports numériques associés aux sites internet'
    expect(splitSkills([tooLong])).toEqual([tooLong])
  })
})

describe('extraction: sentences do not become skills', () => {
  const cv = 'Compétences : Rigueur, SEO, RGAA. Installation et maintenance de matériel informatique.'
  const profile: Profile = {
    links: [],
    experiences: [],
    skills: ['Rigueur', 'SEO, RGAA', 'Installation et maintenance de matériel informatique.'],
    education: [],
    languages: [],
  }

  it('removes sentences and splits lists', () => {
    expect(sanitizeProfile(profile, cv).skills).toEqual(['Rigueur', 'SEO', 'RGAA'])
  })
})

describe('tailorCv: profile whose skills contain sentences', () => {
  const profile: Profile = {
    links: [],
    headline: 'Technicien informatique',
    experiences: [
      {
        position: 'Développeur web',
        company: 'Webagence',
        achievements: ['Intégration HTML et CSS', 'Collaboration avec l’équipe design'],
      },
    ],
    skills: [
      'Rigueur',
      'Autonomie',
      'WordPress',
      'Collaboration avec les équipes design et back-end pour garantir la qualité des projets livrés.',
      'Installation et maintenance de matériel informatique',
    ],
    education: [],
    languages: [],
  }
  const jobPosting: JobPosting = {
    jobTitle: 'Chargé(e) de création digitale (H/F)',
    rawText: 'Création de contenus, collaboration avec le design, webmastering WordPress.',
  }
  const engine = () =>
    new MockEngine({
      keywords: {
        keywords: ['WordPress', 'création de contenus', 'webmastering'],
        requiredSkills: ['Collaboration avec le design'],
      },
      // The model only keeps the technical term: soft skills must be kept anyway.
      relevance: { usefulSkills: [2] },
      summary: { summary: '' },
    })

  it('only keeps short skills, soft skills kept', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    const allOfThem = [...cv.keySkills, ...cv.skills]
    expect(allOfThem.every(isShortSkill)).toBe(true)
    expect(cv.skills).toEqual(expect.arrayContaining(['Rigueur', 'Autonomie']))
    expect(allOfThem.join(' ')).not.toMatch(/maintenance|back-end/)
  })

  it('puts in key skills those requested by the job posting and evidenced by the profile', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    expect(cv.keySkills).toEqual(expect.arrayContaining(['WordPress']))
    // No duplicate between key skills and other skills.
    expect(cv.skills).not.toContain('WordPress')
  })

  it('the export structures the skills into labelled lines', async () => {
    const cv = tailoredCvSchema.parse({
      headline: 'Chargé de création digitale',
      summary: '',
      keySkills: ['WordPress', 'Création de contenus'],
      skills: ['Rigueur', 'Autonomie', 'HTML / CSS'],
    })
    const model = buildCvDocument(profile, cv)
    const section = model.sections.find((s) => s.id === 'skills')
    expect(section?.blocks).toEqual([
      { type: 'labelled-list', label: 'Compétences clés', elements: ['WordPress', 'Création de contenus'] },
      { type: 'labelled-list', label: 'Savoir-être', elements: ['Rigueur', 'Autonomie'] },
      { type: 'labelled-list', label: 'Outils et techniques', elements: ['HTML / CSS'] },
    ])
  })
})

describe('softSkillsSentence', () => {
  it('composes a correct sentence: adjectives turned into nouns, elisions respected', () => {
    expect(softSkillsSentence(['Adaptable', 'Travail en équipe', 'Autonomie', 'Rigueur'])).toBe(
      'Je fais preuve d’adaptabilité, d’esprit d’équipe, d’autonomie et de rigueur.',
    )
    expect(softSkillsSentence(['Sens du détail'])).toBe('Je fais preuve de sens du détail.')
    expect(softSkillsSentence([])).toBe('')
  })
})
