import { describe, expect, it } from 'vitest'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { boundSummary, tailorCv } from './pipeline'
import { harmonizeExperiences } from './relevance'
import { cleanBullet } from './rewriting'

describe('harmoniserExperiences', () => {
  const positions = [
    { position: 'Développeur web front' },
    { position: 'Développeur Web Front' },
    { position: 'Carrossier' },
  ]

  it('donne la même note aux expériences au même intitulé de poste', () => {
    expect(harmonizeExperiences([0, 1, 0], positions)).toEqual([1, 1, 0])
  })

  it('propage la note la plus haute entre expériences du même domaine', () => {
    const experiences = [{ position: 'Intégrateur' }, { position: 'Webmaster' }, { position: 'Carrossier' }]
    expect(
      harmonizeExperiences([0, 2, 0], experiences, ['développement web', 'Développement web', 'carrosserie']),
    ).toEqual([2, 2, 0])
  })

  it('ne change rien si les expériences n’ont ni poste ni domaine en commun', () => {
    const experiences = [{ position: 'A' }, { position: 'B' }]
    expect(harmonizeExperiences([2, 0], experiences, ['x', 'y'])).toEqual([2, 0])
  })
})

describe('adapterCv : titre, durées et compétences attestées', () => {
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

  it('le titre du CV est celui de l’offre, jamais rédigé par le modèle ; l’accroche ne s’en réclame pas', async () => {
    const cv = await tailorCv(engine('Community Manager expérimenté.'), profile, jobPosting)
    expect(cv.headline).toBe('Community Manager')
    // Rejetée (le poste visé n'est pas à affirmer) : phrase de qualités attestées, jamais l'ancienne accroche.
    expect(cv.summary).not.toMatch(/expérimenté/)
    expect(cv.summary).toBe('Je fais preuve de rigueur.')
  })

  it('rejette une durée déduite des dates (« 1 an »)', async () => {
    const cv = await tailorCv(engine('Développeur web avec 1 an d’expérience en SEO.'), profile, jobPosting)
    expect(cv.summary).not.toMatch(/1 an/)
  })

  it('accepte une accroche fidèle sans durée', async () => {
    const faithful = 'Je fais preuve de rigueur pour la gestion éditoriale et l’animation des réseaux sociaux.'
    const cv = await tailorCv(engine(faithful), profile, jobPosting)
    expect(cv.summary).toBe(faithful)
  })

  it('conserve une compétence attestée dans une expérience conservée, même jugée sans rapport', async () => {
    const cv = await tailorCv(engine('Développeur web front.'), profile, jobPosting)
    expect(cv.skills).toEqual(expect.arrayContaining(['SEO', 'RGAA', 'Rigueur']))
    expect(cv.excluded.skills).toEqual(['PHP'])
  })

  it('nettoie l’intitulé de l’offre (genre, entreprise, contrat) pour en faire le titre', async () => {
    const rawJobPosting: JobPosting = {
      jobTitle: 'Community Manager (H/F) - Inéa - CDD',
      company: 'Inéa',
      rawText: jobPosting.rawText,
    }
    const cv = await tailorCv(engine('Développeur web front.'), profile, rawJobPosting)
    expect(cv.headline).toBe('Community Manager')
  })
})

describe('adapterCv : aucune expérience jugée pertinente', () => {
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

  it('met en avant le domaine le plus proche (choix relatif) au lieu de tout garder', async () => {
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

  it('garde tout si le choix est incohérent', async () => {
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

describe('nettoyerPoint / borneAccroche (sorties négligées d’un petit modèle)', () => {
  it('retire la ponctuation parasite et abandonne les puces sans mot', () => {
    expect(cleanBullet(',Collaboration avec les équipes design')).toBe('Collaboration avec les équipes design')
    expect(cleanBullet('"Optimisation des performances",')).toBe('Optimisation des performances')
    expect(cleanBullet('],')).toBe('')
    expect(cleanBullet('  ')).toBe('')
  })

  it('coupe une accroche trop longue à la dernière phrase complète', () => {
    const sentence = 'Développeur web attentif au SEO et à l’accessibilité des interfaces. '
    const tooLong = sentence.repeat(10)
    const boundedValue = boundSummary(tooLong)
    expect(boundedValue.length).toBeLessThanOrEqual(450)
    expect(boundedValue.endsWith('.')).toBe(true)
    expect(boundSummary('Courte accroche.')).toBe('Courte accroche.')
    expect(boundSummary('x'.repeat(600))).toBe('')
  })
})

describe('adapterCv : signalement des étapes', () => {
  it('signale chaque étape, avec la progression expérience par expérience', async () => {
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
    const steps: { label: string; current?: number; total?: number }[] = []
    await tailorCv(m, profile, { jobTitle: 'Dev', rawText: 'Offre' }, { rewrite: true, onStep: (e) => steps.push(e) })
    expect(steps.map((e) => e.label)).toEqual([
      'Analyse de l’offre',
      'Choix des éléments du profil à mettre en avant',
      'Reformulation des expériences',
      'Reformulation des expériences',
      'Rédaction de l’accroche',
    ])
    expect(steps.filter((e) => e.current !== undefined).map((e) => `${e.current}/${e.total}`)).toEqual(['1/2', '2/2'])
  })
})

describe('adapterCv : compétences composées', () => {
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

  it('ne valide pas « Gestion & créa. de landing pages » sur le seul mot « gestion »', async () => {
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
