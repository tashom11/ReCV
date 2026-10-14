import { describe, expect, it } from 'vitest'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { tailorCv } from './pipeline'

// Cas réel : CV de développeur web (avec un passé de carrossier) face à une offre de carrossier peintre.
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

describe('adapterCv : écarte ce qui est sans rapport avec l’offre', () => {
  it('ne garde que le métier visé et liste le reste dans « ecartes »', async () => {
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

  it('ne transmet rien du domaine écarté au modèle qui rédige l’accroche', async () => {
    const m = engine({ summary: 'Carrossier peintre.' })
    await tailorCv(m, profile, jobPosting)
    const writing = m.requests.find((r) => r.name === 'summary')
    expect(writing?.user).not.toMatch(/Webagence|HTML|WordPress|développement web|Développeur web/i)
    // Seuls les savoir-être et les réalisations qui recoupent l'offre sont transmis : ni postes, ni employeurs.
    expect(writing?.user).not.toMatch(/Dupont|Carrossier peintre"/)
    expect(writing?.user).toContain('Rigueur')
  })

  it('remplace une accroche qui réintroduit le domaine écarté (jamais celle du profil d’origine) ; le titre vient du profil', async () => {
    const cv = await tailorCv(engine({ summary: 'Carrossier peintre et expert HTML / CSS.' }), profile, jobPosting)
    expect(cv.headline).toBe('Carrossier peintre')
    // Rejetée : repli sur une phrase de qualités attestées (jamais l'ancienne accroche du profil).
    expect(cv.summary).toMatch(/^Je fais preuve de /)
    expect(cv.summary).not.toMatch(/HTML|WordPress/)
  })

  it('garde une compétence citée mot pour mot dans l’offre, même jugée sans rapport', async () => {
    const jobPostingWithCss: JobPosting = {
      ...jobPosting,
      rawText: `${jobPosting.rawText} Notions de WordPress appréciées.`,
    }
    const cv = await tailorCv(engine({ summary: 'Carrossier peintre.' }), profile, jobPostingWithCss)
    expect(cv.skills).toContain('WordPress / CMS')
    expect(cv.excluded.skills).toEqual(['HTML / CSS'])
  })

  it('ne vide jamais une section : tout est conservé si tout est jugé sans rapport', async () => {
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
