import { describe, expect, it } from 'vitest'
import { cleanJobTitle } from '../job-posting/text'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { tailoredCvSchema } from '../schemas'
import { composeCv, initialChoices } from './composition'
import { analyzeCoverage, dejaListee } from './coverage'
import { tailorCv } from './pipeline'

const profile: Profile = {
  headline: 'Technicien informatique',
  links: [],
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Agence Pixel',
      achievements: ['Suivi des performances avec Google Search Console', 'Intégration HTML et CSS'],
    },
  ],
  skills: ['WordPress / CMS', 'Matomo', 'Rigueur'],
  education: [],
  languages: [],
}

const analysis = {
  softSkills: [] as string[],
  requiredEducation: '',
  requiredExperience: '',
  targetTitle: 'Consultant SEO',
  keywords: ['Google Search Console', 'Ahrefs', 'Matomo'],
  requiredSkills: ['Maîtrise de WordPress', 'Rigueur', 'Sens de la pédagogie', 'Consultant SEO'],
}

describe('analyserCouverture', () => {
  it('sépare les compétences demandées déjà attestées dans le profil de celles qui manquent', () => {
    const c = analyzeCoverage(profile, analysis)
    expect(c.evidenced).toEqual(expect.arrayContaining(['Google Search Console', 'Matomo', 'Rigueur']))
    // « Maîtrise de WordPress » : le mot d'introduction est ignoré, « WordPress » est attesté.
    expect(c.evidenced).toContain('Maîtrise de WordPress')
    expect([...c.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('garde le terme le plus précis quand un terme générique y est inclus', () => {
    const c = analyzeCoverage(profile, {
      targetTitle: 'X',
      softSkills: [],
      requiredEducation: '',
      requiredExperience: '',
      keywords: ['audit', 'audit sémantique', 'analyse', 'analyse technique'],
      requiredSkills: [],
    })
    expect([...c.missing].sort()).toEqual(['analyse technique', 'audit sémantique'])
  })

  it('ignore l’intitulé du poste lui-même et les doublons', () => {
    const c = analyzeCoverage(profile, { ...analysis, keywords: ['matomo', 'Matomo', 'Consultant SEO'] })
    const all = [...c.evidenced, ...c.missing].map((t) => t.toLowerCase())
    expect(all).not.toContain('consultant seo')
    expect(all.filter((t) => t === 'matomo')).toHaveLength(1)
  })

  it('dejaListee reconnaît une compétence déjà représentée', () => {
    expect(dejaListee('Matomo', ['WordPress / CMS', 'Matomo'])).toBe(true)
    expect(dejaListee('WordPress', ['WordPress / CMS'])).toBe(true)
    expect(dejaListee('Ahrefs', ['WordPress / CMS'])).toBe(false)
  })
})

describe('adapterCv : compétences demandées', () => {
  const jobPosting: JobPosting = {
    jobTitle: 'Consultant SEO (H/F)',
    rawText: 'Google Search Console, Ahrefs, Matomo, WordPress.',
  }
  const engine = () =>
    new MockEngine({
      keywords: { keywords: analysis.keywords, requiredSkills: analysis.requiredSkills },
      relevance: {},
      summary: { summary: '' },
    })

  it('n’ajoute jamais d’elle-même une compétence absente du profil', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    expect(cv.headline).toBe('Consultant SEO')
    expect(cv.requested.evidenced).toContain('Google Search Console')
    expect(cv.skills).not.toContain('Ahrefs')
    expect(cv.skills).not.toContain('Sens de la pédagogie')
    expect([...cv.requested.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('les compétences demandées absentes sont proposées décochées, et n’entrent que si l’utilisateur les coche', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    const bullets = [cv.experiences[0]?.bullets ?? []]

    // Par défaut, rien d'absent du profil n'entre dans le CV.
    const choice = initialChoices(cv)
    expect(choice.addRequested.some(Boolean)).toBe(false)
    const prudent = composeCv(profile, cv, choice, bullets)
    expect(prudent.keySkills).not.toContain('Ahrefs')
    expect(prudent.skills).not.toContain('Sens de la pédagogie')

    // Tout coché : le CV colle à l'offre, formulé comme elle.
    choice.addRequested = cv.requested.missing.map(() => true)
    const pasted = composeCv(profile, cv, choice, bullets)
    // Outil → compétences clés ; qualité → ligne Savoir-être.
    expect(pasted.keySkills).toContain('Ahrefs')
    expect(pasted.skills).toContain('Sens de la pédagogie')
    expect(pasted.requested).toEqual({ evidenced: [], missing: [], requirements: {} })

    // L'utilisateur ne coche que ce qu'il maîtrise.
    choice.addRequested = cv.requested.missing.map((t) => t === 'Ahrefs')
    const final = composeCv(profile, cv, choice, bullets)
    expect(final.keySkills).toContain('Ahrefs')
    expect(final.skills).not.toContain('Sens de la pédagogie')
  })

  it('le schéma accepte un CV ancien sans « demandees »', () => {
    const previous = tailoredCvSchema.parse({ headline: 'Dev', summary: '' })
    expect(previous.requested).toEqual({ evidenced: [], missing: [], requirements: {} })
  })
})

describe('nettoyerTitreOffre', () => {
  it('retire genre, entreprise et contrat', () => {
    expect(cleanJobTitle('Consultant.e SEO & GEO - Régie (H/F) - Eskimoz - CDI', 'Eskimoz')).toBe(
      'Consultant.e SEO & GEO - Régie',
    )
    expect(cleanJobTitle('Community Manager - F/H - CDD 12 mois')).toBe('Community Manager')
    expect(cleanJobTitle('Carrossier peintre H/F')).toBe('Carrossier peintre')
    expect(cleanJobTitle('Chargé(e) de mission (h/f/x)')).toBe('Chargé(e) de mission')
  })
})
