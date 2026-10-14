import { describe, expect, it } from 'vitest'
import { cleanJobTitle } from '../job-posting/text'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { tailoredCvSchema } from '../schemas'
import { composeCv, initialChoices } from './composition'
import { analyzeCoverage, isAlreadyListed } from './coverage'
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

describe('analyzeCoverage', () => {
  it('separates requested skills already evidenced in the profile from the missing ones', () => {
    const c = analyzeCoverage(profile, analysis)
    expect(c.evidenced).toEqual(expect.arrayContaining(['Google Search Console', 'Matomo', 'Rigueur']))
    // « Maîtrise de WordPress »: the introductory word is ignored, « WordPress » is evidenced.
    expect(c.evidenced).toContain('Maîtrise de WordPress')
    expect([...c.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('keeps the most precise term when a generic term is included in it', () => {
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

  it('ignores the job title itself and duplicates', () => {
    const c = analyzeCoverage(profile, { ...analysis, keywords: ['matomo', 'Matomo', 'Consultant SEO'] })
    const all = [...c.evidenced, ...c.missing].map((t) => t.toLowerCase())
    expect(all).not.toContain('consultant seo')
    expect(all.filter((t) => t === 'matomo')).toHaveLength(1)
  })

  it('isAlreadyListed recognises a skill already represented', () => {
    expect(isAlreadyListed('Matomo', ['WordPress / CMS', 'Matomo'])).toBe(true)
    expect(isAlreadyListed('WordPress', ['WordPress / CMS'])).toBe(true)
    expect(isAlreadyListed('Ahrefs', ['WordPress / CMS'])).toBe(false)
  })
})

describe('tailorCv: requested skills', () => {
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

  it('never adds by itself a skill absent from the profile', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    expect(cv.headline).toBe('Consultant SEO')
    expect(cv.requested.evidenced).toContain('Google Search Console')
    expect(cv.skills).not.toContain('Ahrefs')
    expect(cv.skills).not.toContain('Sens de la pédagogie')
    expect([...cv.requested.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('requested skills absent from the profile are offered unticked, and only enter if the user ticks them', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    const bullets = [cv.experiences[0]?.bullets ?? []]

    // By default, nothing absent from the profile enters the CV.
    const choice = initialChoices(cv)
    expect(choice.addRequested.some(Boolean)).toBe(false)
    const prudent = composeCv(profile, cv, choice, bullets)
    expect(prudent.keySkills).not.toContain('Ahrefs')
    expect(prudent.skills).not.toContain('Sens de la pédagogie')

    // Everything ticked: the CV matches the job posting, worded like it.
    choice.addRequested = cv.requested.missing.map(() => true)
    const pasted = composeCv(profile, cv, choice, bullets)
    // Tool → key skills; quality → soft skills line.
    expect(pasted.keySkills).toContain('Ahrefs')
    expect(pasted.skills).toContain('Sens de la pédagogie')
    expect(pasted.requested).toEqual({ evidenced: [], missing: [], requirements: {} })

    // The user only ticks what they master.
    choice.addRequested = cv.requested.missing.map((t) => t === 'Ahrefs')
    const final = composeCv(profile, cv, choice, bullets)
    expect(final.keySkills).toContain('Ahrefs')
    expect(final.skills).not.toContain('Sens de la pédagogie')
  })

  it('the schema accepts an older CV without « requested »', () => {
    const previous = tailoredCvSchema.parse({ headline: 'Dev', summary: '' })
    expect(previous.requested).toEqual({ evidenced: [], missing: [], requirements: {} })
  })
})

describe('cleanJobTitle', () => {
  it('removes gender, company and contract', () => {
    expect(cleanJobTitle('Consultant.e SEO & GEO - Régie (H/F) - Eskimoz - CDI', 'Eskimoz')).toBe(
      'Consultant.e SEO & GEO - Régie',
    )
    expect(cleanJobTitle('Community Manager - F/H - CDD 12 mois')).toBe('Community Manager')
    expect(cleanJobTitle('Carrossier peintre H/F')).toBe('Carrossier peintre')
    expect(cleanJobTitle('Chargé(e) de mission (h/f/x)')).toBe('Chargé(e) de mission')
  })
})
