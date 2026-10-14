import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { JobPosting, Profile } from '../schemas'
import { harmoniserExperiences } from './pertinence'
import { adapterCv, borneAccroche } from './pipeline'
import { nettoyerPoint } from './reecriture'

describe('harmoniserExperiences', () => {
  const postes = [
    { position: 'Développeur web front' },
    { position: 'Développeur Web Front' },
    { position: 'Carrossier' },
  ]

  it('donne la même note aux expériences au même intitulé de poste', () => {
    expect(harmoniserExperiences([0, 1, 0], postes)).toEqual([1, 1, 0])
  })

  it('propage la note la plus haute entre expériences du même domaine', () => {
    const experiences = [{ position: 'Intégrateur' }, { position: 'Webmaster' }, { position: 'Carrossier' }]
    expect(
      harmoniserExperiences([0, 2, 0], experiences, ['développement web', 'Développement web', 'carrosserie']),
    ).toEqual([2, 2, 0])
  })

  it('ne change rien si les expériences n’ont ni poste ni domaine en commun', () => {
    const experiences = [{ position: 'A' }, { position: 'B' }]
    expect(harmoniserExperiences([2, 0], experiences, ['x', 'y'])).toEqual([2, 0])
  })
})

describe('adapterCv : titre, durées et compétences attestées', () => {
  const profil: Profile = {
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
  const offre: JobPosting = {
    jobTitle: 'Community Manager',
    rawText: 'Animation des réseaux sociaux, gestion éditoriale, mise à jour du site internet.',
  }
  const moteur = (accroche: string) =>
    new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: ['Community Manager'], competencesRequises: [] },
      pertinence: {
        experiences: [
          { indice: 0, pertinence: 1 },
          { indice: 1, pertinence: 0 },
        ],
        competencesUtiles: [3],
      },
      reecriture: { points: [] },
      accroche: { accroche },
    })

  it('le titre du CV est celui de l’offre, jamais rédigé par le modèle ; l’accroche ne s’en réclame pas', async () => {
    const cv = await adapterCv(moteur('Community Manager expérimenté.'), profil, offre)
    expect(cv.headline).toBe('Community Manager')
    // Rejetée (le poste visé n'est pas à affirmer) : phrase de qualités attestées, jamais l'ancienne accroche.
    expect(cv.summary).not.toMatch(/expérimenté/)
    expect(cv.summary).toBe('Je fais preuve de rigueur.')
  })

  it('rejette une durée déduite des dates (« 1 an »)', async () => {
    const cv = await adapterCv(moteur('Développeur web avec 1 an d’expérience en SEO.'), profil, offre)
    expect(cv.summary).not.toMatch(/1 an/)
  })

  it('accepte une accroche fidèle sans durée', async () => {
    const fidele = 'Je fais preuve de rigueur pour la gestion éditoriale et l’animation des réseaux sociaux.'
    const cv = await adapterCv(moteur(fidele), profil, offre)
    expect(cv.summary).toBe(fidele)
  })

  it('conserve une compétence attestée dans une expérience conservée, même jugée sans rapport', async () => {
    const cv = await adapterCv(moteur('Développeur web front.'), profil, offre)
    expect(cv.skills).toEqual(expect.arrayContaining(['SEO', 'RGAA', 'Rigueur']))
    expect(cv.excluded.skills).toEqual(['PHP'])
  })

  it('nettoie l’intitulé de l’offre (genre, entreprise, contrat) pour en faire le titre', async () => {
    const offreBrute: JobPosting = {
      jobTitle: 'Community Manager (H/F) - Inéa - CDD',
      company: 'Inéa',
      rawText: offre.rawText,
    }
    const cv = await adapterCv(moteur('Développeur web front.'), profil, offreBrute)
    expect(cv.headline).toBe('Community Manager')
  })
})

describe('adapterCv : aucune expérience jugée pertinente', () => {
  const profil: Profile = {
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
  const offre: JobPosting = { jobTitle: 'Community Manager', rawText: 'Animation des réseaux sociaux.' }
  const notesNulles = {
    experiences: [
      { indice: 0, domaine: 'développement web', pertinence: 0 },
      { indice: 1, domaine: 'carrosserie automobile', pertinence: 0 },
    ],
  }

  it('met en avant le domaine le plus proche (choix relatif) au lieu de tout garder', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: [] },
      pertinence: notesNulles,
      domaineProche: { choix: 0 },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.experiences.map((e) => e.company)).toEqual(['Webagence'])
    expect(cv.excluded.experiences.map((e) => e.company)).toEqual(['Dupont'])
    expect(cv.headline).toBe('Community Manager')
  })

  it('garde tout si le choix est incohérent', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: [] },
      pertinence: notesNulles,
      domaineProche: { choix: 42 },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.experiences).toHaveLength(2)
  })
})

describe('nettoyerPoint / borneAccroche (sorties négligées d’un petit modèle)', () => {
  it('retire la ponctuation parasite et abandonne les puces sans mot', () => {
    expect(nettoyerPoint(',Collaboration avec les équipes design')).toBe('Collaboration avec les équipes design')
    expect(nettoyerPoint('"Optimisation des performances",')).toBe('Optimisation des performances')
    expect(nettoyerPoint('],')).toBe('')
    expect(nettoyerPoint('  ')).toBe('')
  })

  it('coupe une accroche trop longue à la dernière phrase complète', () => {
    const phrase = 'Développeur web attentif au SEO et à l’accessibilité des interfaces. '
    const longue = phrase.repeat(10)
    const bornee = borneAccroche(longue)
    expect(bornee.length).toBeLessThanOrEqual(450)
    expect(bornee.endsWith('.')).toBe(true)
    expect(borneAccroche('Courte accroche.')).toBe('Courte accroche.')
    expect(borneAccroche('x'.repeat(600))).toBe('')
  })
})

describe('adapterCv : signalement des étapes', () => {
  it('signale chaque étape, avec la progression expérience par expérience', async () => {
    const profil: Profile = {
      links: [],
      experiences: [
        { position: 'A', company: 'X', achievements: ['Réalisation une'] },
        { position: 'B', company: 'Y', achievements: ['Réalisation deux'] },
      ],
      skills: [],
      education: [],
      languages: [],
    }
    const m = new MoteurMock({
      motsCles: { titreCible: 'Dev', motsCles: [] },
      pertinence: {},
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const etapes: { etape: string; courant?: number; total?: number }[] = []
    await adapterCv(
      m,
      profil,
      { jobTitle: 'Dev', rawText: 'Offre' },
      { reformuler: true, surEtape: (e) => etapes.push(e) },
    )
    expect(etapes.map((e) => e.etape)).toEqual([
      'Analyse de l’offre',
      'Choix des éléments du profil à mettre en avant',
      'Reformulation des expériences',
      'Reformulation des expériences',
      'Rédaction de l’accroche',
    ])
    expect(etapes.filter((e) => e.courant !== undefined).map((e) => `${e.courant}/${e.total}`)).toEqual(['1/2', '2/2'])
  })
})

describe('adapterCv : compétences composées', () => {
  const profil: Profile = {
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
  const offre: JobPosting = {
    jobTitle: 'Carrossier peintre',
    rawText: 'Gestion des véhicules confiés, ponçage, peinture. Rigueur exigée.',
  }

  it('ne valide pas « Gestion & créa. de landing pages » sur le seul mot « gestion »', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Carrossier peintre', motsCles: ['ponçage'] },
      pertinence: {
        experiences: [{ indice: 0, pertinence: 2 }],
        competencesUtiles: [2],
      },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.skills).toEqual(['Rigueur'])
    expect(cv.excluded.skills).toEqual(['Gestion & créa. de landing pages', 'HTML / CSS'])
  })
})
