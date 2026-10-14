import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import { extraireSections, preparerTexteAnalyse } from '../offre/sections'
import type { JobPosting, Profile } from '../schemas'
import { cleCompetence, estSavoirEtre, sansDoublons } from './competences'
import { choixInitial, composerCv } from './composition'
import { analyserCouverture, niveauEtudes } from './couverture'
import { adapterCv } from './pipeline'

const OFFRE = [
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

describe('extraireSections', () => {
  it('isole la rubrique « profil recherché » (titre dupliqué, deux-points compris)', () => {
    const s = extraireSections(OFFRE)
    expect(s.profil).toContain('LinkedIn Recruiter')
    expect(s.profil).toContain('Formation Bac +3')
    expect(s.profil).not.toContain('Analyser les besoins')
    expect(s.missions).toContain('Analyser les besoins des managers')
  })

  it('place le profil recherché en tête du texte confié au modèle, sans le tronquer', () => {
    const texte = preparerTexteAnalyse(OFFRE)
    expect(texte.startsWith('PROFIL RECHERCHÉ :')).toBe(true)
    expect(texte.indexOf('PROFIL RECHERCHÉ')).toBeLessThan(texte.indexOf('MISSIONS ET CONTEXTE'))
    expect(texte).toContain('CRM candidats')
  })

  it('sans rubrique reconnue : texte nettoyé simple', () => {
    expect(preparerTexteAnalyse('Offre courte sans rubriques.')).toBe('Offre courte sans rubriques.')
  })
})

describe('prérequis', () => {
  it('lit le niveau d’études', () => {
    expect(niveauEtudes('Bac +3 à Bac +5')).toBe(3)
    expect(niveauEtudes('BAC +2')).toBe(2)
    expect(niveauEtudes('Master en communication')).toBe(5)
    expect(niveauEtudes('BAC PRO')).toBe(0)
    expect(niveauEtudes('CAP pâtisserie')).toBeNull()
  })

  const profil: Profile = {
    links: [],
    experiences: [{ position: 'Développeur web', company: 'Webagence', achievements: ['Intégration HTML'] }],
    skills: ['Autonomie', 'Travail en équipe'],
    education: [
      { degree: 'BAC +2', school: 'École du Code' },
      { degree: 'BAC PRO', school: 'LP' },
    ],
    languages: [],
  }
  const analyse = {
    titreCible: 'Chargé de sourcing et de recrutement',
    competencesRequises: ['LinkedIn Recruiter', 'CRM candidats'],
    qualites: ['Autonomie', 'Orienté résultats'],
    motsCles: [],
    formationRequise: 'Bac +3 à Bac +5',
    experienceRequise: '2 ans minimum en recrutement',
  }

  it('compare formation et expérience exigées au profil', () => {
    const { requirements: prerequis } = analyserCouverture(profil, analyse)
    expect(prerequis.education).toEqual({ required: 'Bac +3 à Bac +5', status: 'insufficient', profileValue: 'BAC +2' })
    expect(prerequis.experience).toEqual({ required: '2 ans minimum en recrutement', status: 'not-found' })
  })

  it('reconnaît un niveau suffisant et une expérience du domaine', () => {
    const fort: Profile = {
      ...profil,
      education: [{ degree: 'Master RH', school: 'Université' }],
      experiences: [{ position: 'Chargé de recrutement', company: 'X', achievements: [] }],
    }
    const { requirements: prerequis } = analyserCouverture(fort, analyse)
    expect(prerequis.education?.status).toBe('ok')
    expect(prerequis.experience?.status).toBe('found')
  })

  it('qualités et outils du profil recherché sont demandés ; intitulé et contexte sont écartés', () => {
    const c = analyserCouverture(profil, {
      ...analyse,
      motsCles: ['Chargé de sourcing', 'Remplacement', 'stratégie', 'vivier de candidats'],
    })
    expect(c.evidenced).toContain('Autonomie')
    expect(c.missing).toEqual(expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats', 'Orienté résultats']))
    const tous = [...c.evidenced, ...c.missing]
    expect(tous).not.toContain('Chargé de sourcing')
    expect(tous).not.toContain('Remplacement')
    // Mot isolé vague non attesté : non proposé.
    expect(tous).not.toContain('stratégie')
  })
})

describe('savoir-être demandés et mise en forme', () => {
  it('reconnaît les qualités typiques d’un profil recherché', () => {
    for (const q of ['Orienté résultats', 'Assertif', 'Sens du conseil', 'Aisance relationnelle', 'Adaptable']) {
      expect(estSavoirEtre(q)).toBe(true)
    }
    for (const t of ['LinkedIn Recruiter', 'CRM candidats', 'Approche directe']) expect(estSavoirEtre(t)).toBe(false)
  })

  it('dédoublonne « Adaptable » / « Adaptabilité » sans confondre « Sens du détail » et « Sens du conseil »', () => {
    expect(cleCompetence('Adaptable')).toBe(cleCompetence('Adaptabilité'))
    expect(sansDoublons(['Adaptable', 'Adaptabilité', 'Sens du détail', 'Sens du conseil'])).toEqual([
      'Adaptable',
      'Sens du détail',
      'Sens du conseil',
    ])
  })
})

describe('adapterCv : profil recherché', () => {
  const profil: Profile = {
    links: [],
    headline: 'Développeur web',
    experiences: [{ position: 'Développeur web', company: 'Webagence', achievements: ['Intégration HTML et CSS'] }],
    skills: ['Rigueur', 'Autonomie', 'Travail en équipe', 'HTML / CSS'],
    education: [{ degree: 'BAC +2', school: 'École du Code' }],
    languages: [],
  }
  const offre: JobPosting = { jobTitle: 'Chargé de sourcing et de recrutement (H/F)', rawText: OFFRE }
  const moteur = () =>
    new MoteurMock({
      motsCles: {
        competencesRequises: ['LinkedIn Recruiter', 'CRM candidats'],
        qualites: ['Autonomie', 'Orienté résultats', 'Sens du conseil'],
        motsCles: ['Remplacement'],
        formationRequise: 'Bac +3 à Bac +5',
        experienceRequise: '2 ans minimum en recrutement',
      },
      pertinence: {},
      accroche: { accroche: '' },
    })

  it('place outils demandés en compétences clés et qualités demandées parmi les savoir-être, une fois cochés', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    expect(cv.headline).toBe('Chargé de sourcing et de recrutement')
    expect(cv.requested.missing).toEqual(
      expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats', 'Orienté résultats', 'Sens du conseil']),
    )
    expect(cv.requested.requirements.education?.status).toBe('insufficient')

    const final = composerCv(
      profil,
      cv,
      { ...choixInitial(cv), ajouterDemandees: cv.requested.missing.map(() => true) },
      cv.experiences.map((e) => e.bullets),
    )
    expect(final.keySkills).toEqual(expect.arrayContaining(['LinkedIn Recruiter', 'CRM candidats']))
    expect(final.skills).toEqual(expect.arrayContaining(['Orienté résultats', 'Sens du conseil', 'Autonomie']))
    expect(final.keySkills).not.toContain('Orienté résultats')
    expect([...final.keySkills, ...final.skills]).not.toContain('Remplacement')
  })

  it('donne le profil recherché au modèle d’analyse, en premier', async () => {
    const m = moteur()
    await adapterCv(m, profil, offre)
    const requete = m.requetes.find((r) => r.nom === 'motsCles')
    expect(requete?.utilisateur).toContain('PROFIL RECHERCHÉ :')
    expect(requete?.utilisateur).toContain('LinkedIn Recruiter')
  })
})
