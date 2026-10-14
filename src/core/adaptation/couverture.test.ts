import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import { nettoyerTitreOffre } from '../offre/texte'
import type { JobPosting, Profile } from '../schemas'
import { tailoredCvSchema } from '../schemas'
import { choixInitial, composerCv } from './composition'
import { analyserCouverture, dejaListee } from './couverture'
import { adapterCv } from './pipeline'

const profil: Profile = {
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

const analyse = {
  qualites: [] as string[],
  formationRequise: '',
  experienceRequise: '',
  titreCible: 'Consultant SEO',
  motsCles: ['Google Search Console', 'Ahrefs', 'Matomo'],
  competencesRequises: ['Maîtrise de WordPress', 'Rigueur', 'Sens de la pédagogie', 'Consultant SEO'],
}

describe('analyserCouverture', () => {
  it('sépare les compétences demandées déjà attestées dans le profil de celles qui manquent', () => {
    const c = analyserCouverture(profil, analyse)
    expect(c.evidenced).toEqual(expect.arrayContaining(['Google Search Console', 'Matomo', 'Rigueur']))
    // « Maîtrise de WordPress » : le mot d'introduction est ignoré, « WordPress » est attesté.
    expect(c.evidenced).toContain('Maîtrise de WordPress')
    expect([...c.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('garde le terme le plus précis quand un terme générique y est inclus', () => {
    const c = analyserCouverture(profil, {
      titreCible: 'X',
      qualites: [],
      formationRequise: '',
      experienceRequise: '',
      motsCles: ['audit', 'audit sémantique', 'analyse', 'analyse technique'],
      competencesRequises: [],
    })
    expect([...c.missing].sort()).toEqual(['analyse technique', 'audit sémantique'])
  })

  it('ignore l’intitulé du poste lui-même et les doublons', () => {
    const c = analyserCouverture(profil, { ...analyse, motsCles: ['matomo', 'Matomo', 'Consultant SEO'] })
    const tous = [...c.evidenced, ...c.missing].map((t) => t.toLowerCase())
    expect(tous).not.toContain('consultant seo')
    expect(tous.filter((t) => t === 'matomo')).toHaveLength(1)
  })

  it('dejaListee reconnaît une compétence déjà représentée', () => {
    expect(dejaListee('Matomo', ['WordPress / CMS', 'Matomo'])).toBe(true)
    expect(dejaListee('WordPress', ['WordPress / CMS'])).toBe(true)
    expect(dejaListee('Ahrefs', ['WordPress / CMS'])).toBe(false)
  })
})

describe('adapterCv : compétences demandées', () => {
  const offre: JobPosting = {
    jobTitle: 'Consultant SEO (H/F)',
    rawText: 'Google Search Console, Ahrefs, Matomo, WordPress.',
  }
  const moteur = () =>
    new MoteurMock({
      motsCles: { motsCles: analyse.motsCles, competencesRequises: analyse.competencesRequises },
      pertinence: {},
      accroche: { accroche: '' },
    })

  it('n’ajoute jamais d’elle-même une compétence absente du profil', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    expect(cv.headline).toBe('Consultant SEO')
    expect(cv.requested.evidenced).toContain('Google Search Console')
    expect(cv.skills).not.toContain('Ahrefs')
    expect(cv.skills).not.toContain('Sens de la pédagogie')
    expect([...cv.requested.missing].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('les compétences demandées absentes sont proposées décochées, et n’entrent que si l’utilisateur les coche', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    const points = [cv.experiences[0]?.bullets ?? []]

    // Par défaut, rien d'absent du profil n'entre dans le CV.
    const choix = choixInitial(cv)
    expect(choix.ajouterDemandees.some(Boolean)).toBe(false)
    const prudent = composerCv(profil, cv, choix, points)
    expect(prudent.keySkills).not.toContain('Ahrefs')
    expect(prudent.skills).not.toContain('Sens de la pédagogie')

    // Tout coché : le CV colle à l'offre, formulé comme elle.
    choix.ajouterDemandees = cv.requested.missing.map(() => true)
    const colle = composerCv(profil, cv, choix, points)
    // Outil → compétences clés ; qualité → ligne Savoir-être.
    expect(colle.keySkills).toContain('Ahrefs')
    expect(colle.skills).toContain('Sens de la pédagogie')
    expect(colle.requested).toEqual({ evidenced: [], missing: [], requirements: {} })

    // L'utilisateur ne coche que ce qu'il maîtrise.
    choix.ajouterDemandees = cv.requested.missing.map((t) => t === 'Ahrefs')
    const final = composerCv(profil, cv, choix, points)
    expect(final.keySkills).toContain('Ahrefs')
    expect(final.skills).not.toContain('Sens de la pédagogie')
  })

  it('le schéma accepte un CV ancien sans « demandees »', () => {
    const ancien = tailoredCvSchema.parse({ headline: 'Dev', summary: '' })
    expect(ancien.requested).toEqual({ evidenced: [], missing: [], requirements: {} })
  })
})

describe('nettoyerTitreOffre', () => {
  it('retire genre, entreprise et contrat', () => {
    expect(nettoyerTitreOffre('Consultant.e SEO & GEO - Régie (H/F) - Eskimoz - CDI', 'Eskimoz')).toBe(
      'Consultant.e SEO & GEO - Régie',
    )
    expect(nettoyerTitreOffre('Community Manager - F/H - CDD 12 mois')).toBe('Community Manager')
    expect(nettoyerTitreOffre('Carrossier peintre H/F')).toBe('Carrossier peintre')
    expect(nettoyerTitreOffre('Chargé(e) de mission (h/f/x)')).toBe('Chargé(e) de mission')
  })
})
