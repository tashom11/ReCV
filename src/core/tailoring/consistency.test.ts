import { describe, expect, it } from 'vitest'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { boundSummary, tailorCv } from './pipeline'
import { harmonizeExperiences } from './relevance'
import { cleanBullet } from './rewriting'

describe('harmonizeExperiences', () => {
  const positions = [
    { position: 'Développeur web front' },
    { position: 'Développeur Web Front' },
    { position: 'Carrossier' },
  ]

  it('gives the same score to experiences with the same job title', () => {
    expect(harmonizeExperiences([0, 1, 0], positions)).toEqual([1, 1, 0])
  })

  it('spreads the highest score among experiences of the same field', () => {
    const experiences = [{ position: 'Intégrateur' }, { position: 'Webmaster' }, { position: 'Carrossier' }]
    expect(
      harmonizeExperiences([0, 2, 0], experiences, ['développement web', 'Développement web', 'carrosserie']),
    ).toEqual([2, 2, 0])
  })

  it('changes nothing if the experiences share neither position nor field', () => {
    const experiences = [{ position: 'A' }, { position: 'B' }]
    expect(harmonizeExperiences([2, 0], experiences, ['x', 'y'])).toEqual([2, 0])
  })
})

describe('tailorCv: headline, durations and evidenced skills', () => {
  const profile: Profile = {
    headline: 'Développeur web front',
    summary: 'Accroche d’origine',
    links: [],
    experiences: [
      {
        position: 'Développeur web front',
        company: 'Agence Pixel',
        dateRange: '2021 - 2022',
        achievements: ['Respect des standards SEO et de l’accessibilité (RGAA)'],
      },
      { position: 'Carrossier peintre', company: 'Dupont', dateRange: '2016 - 2020', achievements: ['Ponçage'] },
    ],
    skills: ['SEO', 'RGAA', 'PHP', 'Rigueur'],
    education: [],
    languages: [],
  }
  const jobPosting: JobPosting = {
    jobTitle: 'Community Manager',
    rawText: 'Animation des réseaux sociaux, gestion éditoriale, mise à jour du site internet.',
  }
  const engine = (summary: string) =>
    new MockEngine({
      keywords: { targetTitle: 'Community Manager', keywords: ['Community Manager'], requiredSkills: [] },
      relevance: {
        experiences: [
          { index: 0, relevance: 1 },
          { index: 1, relevance: 0 },
        ],
        usefulSkills: [3],
      },
      rewriting: { bullets: [] },
      summary: { summary },
    })

  it('the CV headline is the job posting title, never written by the model; the summary does not claim it', async () => {
    const cv = await tailorCv(engine('Community Manager expérimenté.'), profile, jobPosting)
    expect(cv.headline).toBe('Community Manager')
    // Rejected (the target position is not to be claimed): sentence of evidenced qualities, never the old summary.
    expect(cv.summary).not.toMatch(/expérimenté/)
    expect(cv.summary).toBe('Je fais preuve de rigueur.')
  })

  it('rejects a duration inferred from the dates (« 1 an »)', async () => {
    const cv = await tailorCv(engine('Développeur web avec 1 an d’expérience en SEO.'), profile, jobPosting)
    expect(cv.summary).not.toMatch(/1 an/)
  })

  it('accepts a faithful summary without duration', async () => {
    const faithful = 'Je fais preuve de rigueur pour la gestion éditoriale et l’animation des réseaux sociaux.'
    const cv = await tailorCv(engine(faithful), profile, jobPosting)
    expect(cv.summary).toBe(faithful)
  })

  it('keeps a skill evidenced in a kept experience, even if judged unrelated', async () => {
    const cv = await tailorCv(engine('Développeur web front.'), profile, jobPosting)
    expect(cv.skills).toEqual(expect.arrayContaining(['SEO', 'RGAA', 'Rigueur']))
    expect(cv.excluded.skills).toEqual(['PHP'])
  })

  it('cleans the job posting title (gender, company, contract) to make the headline', async () => {
    const rawJobPosting: JobPosting = {
      jobTitle: 'Community Manager (H/F) - Inéa - CDD',
      company: 'Inéa',
      rawText: jobPosting.rawText,
    }
    const cv = await tailorCv(engine('Développeur web front.'), profile, rawJobPosting)
    expect(cv.headline).toBe('Community Manager')
  })
})

describe('tailorCv: no experience judged relevant', () => {
  const profile: Profile = {
    headline: 'Développeur web / Carrossier peintre',
    links: [],
    experiences: [
      { position: 'Développeur web front', company: 'Webagence', achievements: ['Intégration'] },
      { position: 'Carrossier peintre', company: 'Dupont', achievements: ['Ponçage'] },
    ],
    skills: [],
    education: [],
    languages: [],
  }
  const jobPosting: JobPosting = { jobTitle: 'Community Manager', rawText: 'Animation des réseaux sociaux.' }
  const zeroScores = {
    experiences: [
      { index: 0, domain: 'développement web', relevance: 0 },
      { index: 1, domain: 'carrosserie automobile', relevance: 0 },
    ],
  }

  it('highlights the closest field (relative choice) instead of keeping everything', async () => {
    const m = new MockEngine({
      keywords: { targetTitle: 'Community Manager', keywords: [] },
      relevance: zeroScores,
      closestDomain: { choice: 0 },
      rewriting: { bullets: [] },
      summary: { summary: '' },
    })
    const cv = await tailorCv(m, profile, jobPosting)
    expect(cv.experiences.map((e) => e.company)).toEqual(['Webagence'])
    expect(cv.excluded.experiences.map((e) => e.company)).toEqual(['Dupont'])
    expect(cv.headline).toBe('Community Manager')
  })

  it('keeps everything if the choice is inconsistent', async () => {
    const m = new MockEngine({
      keywords: { targetTitle: 'Community Manager', keywords: [] },
      relevance: zeroScores,
      closestDomain: { choice: 42 },
      rewriting: { bullets: [] },
      summary: { summary: '' },
    })
    const cv = await tailorCv(m, profile, jobPosting)
    expect(cv.experiences).toHaveLength(2)
  })
})

describe('cleanBullet / boundSummary (sloppy outputs of a small model)', () => {
  it('removes stray punctuation and drops bullets without words', () => {
    expect(cleanBullet(',Collaboration avec les équipes design')).toBe('Collaboration avec les équipes design')
    expect(cleanBullet('"Optimisation des performances",')).toBe('Optimisation des performances')
    expect(cleanBullet('],')).toBe('')
    expect(cleanBullet('  ')).toBe('')
  })

  it('cuts a summary that is too long at the last complete sentence', () => {
    const sentence = 'Développeur web attentif au SEO et à l’accessibilité des interfaces. '
    const tooLong = sentence.repeat(10)
    const boundedValue = boundSummary(tooLong)
    expect(boundedValue.length).toBeLessThanOrEqual(450)
    expect(boundedValue.endsWith('.')).toBe(true)
    expect(boundSummary('Courte accroche.')).toBe('Courte accroche.')
    expect(boundSummary('x'.repeat(600))).toBe('')
  })
})

describe('tailorCv: step reporting', () => {
  it('reports every step, with progress experience by experience', async () => {
    const profile: Profile = {
      links: [],
      experiences: [
        { position: 'A', company: 'X', achievements: ['Réalisation une'] },
        { position: 'B', company: 'Y', achievements: ['Réalisation deux'] },
      ],
      skills: [],
      education: [],
      languages: [],
    }
    const m = new MockEngine({
      keywords: { targetTitle: 'Dev', keywords: [] },
      relevance: {},
      rewriting: { bullets: [] },
      summary: { summary: '' },
    })
    const steps: { key?: string; current?: number; total?: number }[] = []
    await tailorCv(m, profile, { jobTitle: 'Dev', rawText: 'Offre' }, { rewrite: true, onStep: (e) => steps.push(e) })
    expect(steps.map((e) => e.key)).toEqual(['analysis', 'selection', 'rewriting', 'rewriting', 'summary'])
    // The interface words each step itself: no text travels with the progress.
    expect(steps.every((e) => !('label' in e))).toBe(true)
    expect(steps.filter((e) => e.current !== undefined).map((e) => `${e.current}/${e.total}`)).toEqual(['1/2', '2/2'])
  })
})

describe('tailorCv: compound skills', () => {
  const profile: Profile = {
    links: [],
    experiences: [
      {
        position: 'Carrossier peintre',
        company: 'Dupont',
        achievements: ['Gestion du diagnostic des dégâts', 'Ponçage'],
      },
    ],
    skills: ['Gestion & créa. de landing pages', 'HTML / CSS', 'Rigueur'],
    education: [],
    languages: [],
  }
  const jobPosting: JobPosting = {
    jobTitle: 'Carrossier peintre',
    rawText: 'Gestion des véhicules confiés, ponçage, peinture. Rigueur exigée.',
  }

  it('does not validate « Gestion & créa. de landing pages » on the word « gestion » alone', async () => {
    const m = new MockEngine({
      keywords: { targetTitle: 'Carrossier peintre', keywords: ['ponçage'] },
      relevance: {
        experiences: [{ index: 0, relevance: 2 }],
        usefulSkills: [2],
      },
      rewriting: { bullets: [] },
      summary: { summary: '' },
    })
    const cv = await tailorCv(m, profile, jobPosting)
    expect(cv.skills).toEqual(['Rigueur'])
    expect(cv.excluded.skills).toEqual(['Gestion & créa. de landing pages', 'HTML / CSS'])
  })
})
