import { describe, expect, it } from 'vitest'
import { extractSections, prepareAnalysisText } from '../job-posting/sections'
import { MockEngine } from '../llm/mockEngine'
import type { JobPosting, Profile } from '../schemas'
import { composeCv, initialChoices } from './composition'
import { analyzeCoverage, educationLevel } from './coverage'
import { tailorCv } from './pipeline'
import { isSoftSkill, skillKey, withoutDuplicates } from './skills'

const JOB_POSTING = [
  'Chargé de sourcing et de recrutement (H/F)',
  '',
  'Missions',
  '- Analyser les besoins des managers',
  '- Mener les entretiens de recrutement',
  '',
  'Profil recherché',
  '',
  'Profil recherché :',
  '- Formation Bac +3 à Bac +5',
  '- Expérience de deux ans minimum en recrutement, sourcing et chasse de candidats.',
  '- Maîtrise des outils de sourcing (LinkedIn Recruiter, réseaux sociaux, CRM candidats).',
  '- Assertif(ve), adaptable et doté(e) d’un réel sens du conseil.',
  '',
  'Informations complémentaires',
  'Poste en CDD de remplacement.',
].join('\n')

describe('extractSections', () => {
  it('isolates the « profil recherché » section (duplicated heading, colon included)', () => {
    const s = extractSections(JOB_POSTING)
    expect(s.profile).toContain('LinkedIn Recruiter')
    expect(s.profile).toContain('Formation Bac +3')
    expect(s.profile).not.toContain('Analyser les besoins')
    expect(s.missions).toContain('Analyser les besoins des managers')
  })

  it('puts the candidate profile at the top of the text given to the model, without truncating it', () => {
    const text = prepareAnalysisText(JOB_POSTING)
    expect(text.startsWith('PROFIL RECHERCHÉ :')).toBe(true)
    expect(text.indexOf('PROFIL RECHERCHÉ')).toBeLessThan(text.indexOf('MISSIONS ET CONTEXTE'))
    expect(text).toContain('CRM candidats')
  })

  it('without a recognised section: plain cleaned text', () => {
    expect(prepareAnalysisText('Offre courte sans rubriques.')).toBe('Offre courte sans rubriques.')
  })
})

describe('prerequisites', () => {
  it('reads the education level', () => {
    expect(educationLevel('Bac +3 à Bac +5')).toBe(3)
    expect(educationLevel('BAC +2')).toBe(2)
    expect(educationLevel('Master en communication')).toBe(5)
    expect(educationLevel('BAC PRO')).toBe(0)
    expect(educationLevel('CAP pâtisserie')).toBeNull()
  })

  const profile: Profile = {
    links: [],
    experiences: [{ position: 'Développeur web', company: 'Webagence', achievements: ['Intégration HTML'] }],
    skills: ['Autonomie', 'Travail en équipe'],
    education: [
      { degree: 'BAC +2', school: 'École du Code' },
      { degree: 'BAC PRO', school: 'LP' },
    ],
    languages: [],
  }
  const analysis = {
    targetTitle: 'Chargé de sourcing et de recrutement',
    requiredSkills: ['LinkedIn Recruiter', 'CRM candidats'],
    softSkills: ['Autonomie', 'Orienté résultats'],
    keywords: [],
    requiredEducation: 'Bac +3 à Bac +5',
    requiredExperience: '2 ans minimum en recrutement',
  }

  it('compares the required education and experience with the profile', () => {
    const { requirements } = analyzeCoverage(profile, analysis)
    expect(requirements.education).toEqual({
      required: 'Bac +3 à Bac +5',
      status: 'insufficient',
      profileValue: 'BAC +2',
    })
    expect(requirements.experience).toEqual({ required: '2 ans minimum en recrutement', status: 'not-found' })
  })

  it('recognises a sufficient level and an experience in the field', () => {
    const strong: Profile = {
      ...profile,
      education: [{ degree: 'Master RH', school: 'Université' }],
      experiences: [{ position: 'Chargé de recrutement', company: 'X', achievements: [] }],
    }
    const { requirements } = analyzeCoverage(strong, analysis)
    expect(requirements.education?.status).toBe('ok')
    expect(requirements.experience?.status).toBe('found')
  })

  it('qualities and tools of the candidate profile are requested; job title and context are left out', () => {
    const c = analyzeCoverage(profile, {
      ...analysis,
      keywords: ['Chargé de sourcing', 'Remplacement', 'stratégie', 'vivier de candidats'],
    })
    expect(c.evidenced).toContain('Autonomie')
    expect(c.missing).toEqual(expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats', 'Orienté résultats']))
    const all = [...c.evidenced, ...c.missing]
    expect(all).not.toContain('Chargé de sourcing')
    expect(all).not.toContain('Remplacement')
    // Vague isolated word, not evidenced: not offered.
    expect(all).not.toContain('stratégie')
  })
})

describe('requested soft skills and formatting', () => {
  it('recognises the typical qualities of a candidate profile', () => {
    for (const q of ['Orienté résultats', 'Assertif', 'Sens du conseil', 'Aisance relationnelle', 'Adaptable']) {
      expect(isSoftSkill(q)).toBe(true)
    }
    for (const t of ['LinkedIn Recruiter', 'CRM candidats', 'Approche directe']) expect(isSoftSkill(t)).toBe(false)
  })

  it('deduplicates « Adaptable » / « Adaptabilité » without mixing up « Sens du détail » and « Sens du conseil »', () => {
    expect(skillKey('Adaptable')).toBe(skillKey('Adaptabilité'))
    expect(withoutDuplicates(['Adaptable', 'Adaptabilité', 'Sens du détail', 'Sens du conseil'])).toEqual([
      'Adaptable',
      'Sens du détail',
      'Sens du conseil',
    ])
  })
})

describe('tailorCv: candidate profile', () => {
  const profile: Profile = {
    links: [],
    headline: 'Développeur web',
    experiences: [{ position: 'Développeur web', company: 'Webagence', achievements: ['Intégration HTML et CSS'] }],
    skills: ['Rigueur', 'Autonomie', 'Travail en équipe', 'HTML / CSS'],
    education: [{ degree: 'BAC +2', school: 'École du Code' }],
    languages: [],
  }
  const jobPosting: JobPosting = { jobTitle: 'Chargé de sourcing et de recrutement (H/F)', rawText: JOB_POSTING }
  const engine = () =>
    new MockEngine({
      keywords: {
        requiredSkills: ['LinkedIn Recruiter', 'CRM candidats'],
        softSkills: ['Autonomie', 'Orienté résultats', 'Sens du conseil'],
        keywords: ['Remplacement'],
        requiredEducation: 'Bac +3 à Bac +5',
        requiredExperience: '2 ans minimum en recrutement',
      },
      relevance: {},
      summary: { summary: '' },
    })

  it('puts requested tools in key skills and requested qualities among soft skills, once ticked', async () => {
    const cv = await tailorCv(engine(), profile, jobPosting)
    expect(cv.headline).toBe('Chargé de sourcing et de recrutement')
    expect(cv.requested.missing).toEqual(
      expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats', 'Orienté résultats', 'Sens du conseil']),
    )
    expect(cv.requested.requirements.education?.status).toBe('insufficient')

    const final = composeCv(
      profile,
      cv,
      { ...initialChoices(cv), addRequested: cv.requested.missing.map(() => true) },
      cv.experiences.map((e) => e.bullets),
    )
    expect(final.keySkills).toEqual(expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats']))
    expect(final.skills).toEqual(expect.arrayContaining(['Orienté résultats', 'Sens du conseil', 'Autonomie']))
    expect(final.keySkills).not.toContain('Orienté résultats')
    expect([...final.keySkills, ...final.skills]).not.toContain('Remplacement')
  })

  it('gives the candidate profile to the analysis model, first', async () => {
    const m = engine()
    await tailorCv(m, profile, jobPosting)
    const request = m.requests.find((r) => r.name === 'keywords')
    expect(request?.user).toContain('PROFIL RECHERCHÉ :')
    expect(request?.user).toContain('LinkedIn Recruiter')
  })
})
