import { describe, expect, it } from 'vitest'
import { toGrammarSchema } from '../llm/localEngine'
import { MockEngine } from '../llm/mockEngine'
import type { Experience, JobPosting, Profile } from '../schemas'
import { jobAnalysisSchema } from './jobAnalysis'
import { tailorCv } from './pipeline'
import { skillLevels } from './relevance'
import { selectBullets } from './rewriting'

const experience: Experience = {
  position: 'Carrossier peintre',
  company: 'Dupont',
  achievements: [
    'Débosselage et redressage de carrosseries',
    'Application de peintures et vernis',
    'Ponçage et préparation des surfaces',
    'Nettoyage de l’atelier',
    'Gestion du stock de consommables',
  ],
}

describe('selectionnerPoints (sans modèle)', () => {
  it('garde les puces les plus proches de l’offre, dans leur ordre d’origine', () => {
    const selectedIndexes = selectBullets(experience, ['ponçage', 'peinture vernis', 'carrosserie'], 3)
    expect(selectedIndexes).toEqual([
      'Débosselage et redressage de carrosseries',
      'Application de peintures et vernis',
      'Ponçage et préparation des surfaces',
    ])
  })

  it('renvoie tout si le nombre de puces tient dans la limite, sans rien inventer', () => {
    expect(selectBullets(experience, ['x'], 10)).toEqual(experience.achievements)
  })
})

describe('adapterCv : mode rapide par défaut', () => {
  const profile: Profile = {
    links: [],
    headline: 'Carrossier peintre',
    experiences: [experience],
    skills: ['Rigueur'],
    education: [],
    languages: [],
  }
  const jobPosting: JobPosting = { jobTitle: 'Carrossier peintre', rawText: 'Ponçage, peinture et vernis.' }
  const responses = {
    keywords: { keywords: ['ponçage', 'peinture'], requiredSkills: [] },
    relevance: {},
    summary: { summary: '' },
  }

  it('n’appelle pas le modèle pour réécrire les expériences', async () => {
    const m = new MockEngine(responses)
    const cv = await tailorCv(m, profile, jobPosting)
    expect(m.requests.map((r) => r.name)).toEqual(['keywords', 'relevance', 'summary'])
    expect(cv.experiences[0]?.bullets.every((p) => experience.achievements.includes(p))).toBe(true)
    expect(cv.experiences[0]?.bullets).toHaveLength(3)
  })

  it('réutilise une analyse déjà connue (aucun appel « motsCles »)', async () => {
    const m = new MockEngine(responses)
    const known = {
      targetTitle: 'Carrossier peintre',
      keywords: ['ponçage'],
      requiredSkills: [],
      softSkills: [],
      requiredEducation: '',
      requiredExperience: '',
    }
    await tailorCv(m, profile, jobPosting, { analysis: known })
    expect(m.requests.map((r) => r.name)).not.toContain('keywords')
  })

  it('signale l’analyse calculée pour qu’elle soit mémorisée', async () => {
    const m = new MockEngine(responses)
    let received: unknown
    await tailorCv(m, profile, jobPosting, { onAnalysis: (a) => (received = a) })
    expect(received).toMatchObject({ targetTitle: 'Carrossier peintre', keywords: ['ponçage', 'peinture'] })
  })
})

describe('réponses compactes', () => {
  it('borne la liste des mots-clés dans le schéma (grammaire) et tronque une réponse trop longue', () => {
    const grammar = JSON.stringify(toGrammarSchema(jobAnalysisSchema))
    expect(grammar).toContain('"maxItems":8')
    expect(grammar).toContain('"maxLength":40')
    const boundedValue = jobAnalysisSchema.parse({ keywords: Array.from({ length: 30 }, () => 'x'.repeat(100)) })
    expect(boundedValue.keywords).toHaveLength(8)
    expect(boundedValue.keywords[0]).toHaveLength(40)
  })

  it('convertit les indices utiles en niveaux, sans rien retirer si la liste est vide ou invalide', () => {
    expect(skillLevels([0, 2], 4)).toEqual([1, 0, 1, 0])
    expect(skillLevels([], 3)).toEqual([1, 1, 1])
    expect(skillLevels([9, -1], 3)).toEqual([1, 1, 1])
  })
})
