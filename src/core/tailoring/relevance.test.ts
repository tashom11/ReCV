import { describe, expect, it } from 'vitest'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { tailorCv } from './pipeline'

// Real case: CV of a web developer (who used to be a car body painter) against a car body painter job posting.
const profile: Profile = {
  fullName: 'Julien Moreau',
  headline: 'Développeur web / Carrossier peintre',
  summary: 'Expérience de 4 ans en développement web front-end avec HTML, CSS et JavaScript.',
  links: [],
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Webagence',
      dateRange: '2022',
      achievements: ['Intégrer des interfaces utilisateur en HTML, CSS et JavaScript', 'Corriger des bugs'],
    },
    {
      position: 'Carrossier peintre',
      company: 'Carrosserie Dupont',
      dateRange: '2016 - 2020',
      achievements: [
        'Remise en état de carrosseries : débosselage, ponçage, préparation des surfaces',
        'Application de peintures et vernis avec respect des délais',
      ],
    },
  ],
  skills: ['WordPress / CMS', 'HTML / CSS', 'Rigueur', 'Sens du détail'],
  education: [
    { degree: 'BAC +2', school: 'École du Code', dateRange: '2022' },
    { degree: 'BAC PRO', school: 'Lycée Jean Moulin, Douai', dateRange: '2015' },
  ],
  languages: [{ name: 'Français' }],
}

const jobPosting: JobPosting = {
  jobTitle: 'Carrossier peintre H/F',
  rawText: 'Nous recherchons un carrossier peintre rigoureux : ponçage, application de peinture et vernis.',
}

function engine(summary: { summary: string }, skills = [0, 0, 1, 1]) {
  return new MockEngine({
    keywords: { targetTitle: 'Carrossier peintre', keywords: ['carrosserie', 'peinture', 'ponçage'] },
    relevance: {
      experiences: [
        { index: 0, relevance: 0 },
        { index: 1, relevance: 2 },
      ],
      education: [
        { index: 0, relevance: 0 },
        { index: 1, relevance: 1 },
      ],
      usefulSkills: skills.flatMap((relevance, index) => (relevance > 0 ? [index] : [])),
    },
    rewriting: { bullets: ['Ponçage et préparation des surfaces', 'Application de peinture et vernis'] },
    summary,
  })
}

describe('tailorCv: leaves out what is unrelated to the job posting', () => {
  it('only keeps the target trade and lists the rest in « excluded »', async () => {
    const cv = await tailorCv(
      engine({ summary: 'Carrossier peintre rigoureux, attentif aux délais.' }),
      profile,
      jobPosting,
    )
    expect(cv.experiences.map((e) => e.company)).toEqual(['Carrosserie Dupont'])
    expect(cv.experiences[0]?.sourceIndex).toBe(1)
    expect(cv.skills.slice(0, 2)).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.skills).not.toContain('WordPress / CMS')
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC PRO'])
    expect(cv.excluded.experiences.map((e) => e.company)).toEqual(['Webagence'])
    expect(cv.excluded.experiences[0]?.bullets).toEqual(profile.experiences[0]?.achievements)
    expect(cv.excluded.skills).toEqual(['WordPress / CMS', 'HTML / CSS'])
    expect(cv.excluded.education.map((f) => f.degree)).toEqual(['BAC +2'])
    expect(cv.headline).toBe('Carrossier peintre')
    expect(cv.summary).toBe('Carrossier peintre rigoureux, attentif aux délais.')
  })

  it('passes nothing of the excluded field to the model writing the summary', async () => {
    const m = engine({ summary: 'Carrossier peintre.' })
    await tailorCv(m, profile, jobPosting)
    const writing = m.requests.find((r) => r.name === 'summary')
    expect(writing?.user).not.toMatch(/Webagence|HTML|WordPress|développement web|Développeur web/i)
    // Only the soft skills and the achievements matching the job
    // posting are passed on: neither positions nor employers.
    expect(writing?.user).not.toMatch(/Dupont|Carrossier peintre"/)
    expect(writing?.user).toContain('Rigueur')
  })

  it("replaces a summary that brings the excluded field back (never the original profile's); the headline comes from the profile", async () => {
    const cv = await tailorCv(engine({ summary: 'Carrossier peintre et expert HTML / CSS.' }), profile, jobPosting)
    expect(cv.headline).toBe('Carrossier peintre')
    // Rejected: falls back to a sentence of evidenced qualities (never the old summary of the profile).
    expect(cv.summary).toMatch(/^Je fais preuve de /)
    expect(cv.summary).not.toMatch(/HTML|WordPress/)
  })

  it('keeps a skill quoted word for word in the job posting, even if judged unrelated', async () => {
    const jobPostingWithCss: JobPosting = {
      ...jobPosting,
      rawText: `${jobPosting.rawText} Notions de WordPress appréciées.`,
    }
    const cv = await tailorCv(engine({ summary: 'Carrossier peintre.' }), profile, jobPostingWithCss)
    expect(cv.skills).toContain('WordPress / CMS')
    expect(cv.excluded.skills).toEqual(['HTML / CSS'])
  })

  it('never empties a section: everything is kept if everything is judged unrelated', async () => {
    const m = new MockEngine({
      keywords: { targetTitle: 'Astronaute', keywords: [] },
      relevance: {
        experiences: [
          { index: 0, relevance: 0 },
          { index: 1, relevance: 0 },
        ],
      },
      rewriting: { bullets: [] },
      summary: { summary: '' },
    })
    const cv = await tailorCv(m, profile, { jobTitle: 'Astronaute', rawText: 'Voyager dans l’espace.' })
    expect(cv.experiences).toHaveLength(2)
    expect(cv.excluded.experiences).toHaveLength(0)
  })
})
