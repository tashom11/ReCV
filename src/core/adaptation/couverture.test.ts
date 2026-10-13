import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import { nettoyerTitreOffre } from '../offre/texte'
import type { Offre, Profil } from '../schemas'
import { cvAdapteSchema } from '../schemas'
import { choixInitial, composerCv } from './composition'
import { analyserCouverture, dejaListee } from './couverture'
import { adapterCv } from './pipeline'

const profil: Profil = {
  titrePoste: 'Technicien informatique',
  liensProfessionnels: [],
  experiences: [
    {
      poste: 'Développeur web front',
      entreprise: 'Agence Pixel',
      realisations: ['Suivi des performances avec Google Search Console', 'Intégration HTML et CSS'],
    },
  ],
  competences: ['WordPress / CMS', 'Matomo', 'Rigueur'],
  formations: [],
  langues: [],
}

const analyse = {
  titreCible: 'Consultant SEO',
  motsCles: ['Google Search Console', 'Ahrefs', 'Matomo'],
  competencesRequises: ['Maîtrise de WordPress', 'Rigueur', 'Sens de la pédagogie', 'Consultant SEO'],
}

describe('analyserCouverture', () => {
  it('sépare les compétences demandées déjà attestées dans le profil de celles qui manquent', () => {
    const c = analyserCouverture(profil, analyse)
    expect(c.attestees).toEqual(expect.arrayContaining(['Google Search Console', 'Matomo', 'Rigueur']))
    // « Maîtrise de WordPress » : le mot d'introduction est ignoré, « WordPress » est attesté.
    expect(c.attestees).toContain('Maîtrise de WordPress')
    expect([...c.manquantes].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('garde le terme le plus précis quand un terme générique y est inclus', () => {
    const c = analyserCouverture(profil, {
      titreCible: 'X',
      motsCles: ['audit', 'audit sémantique', 'analyse', 'analyse technique'],
      competencesRequises: [],
    })
    expect([...c.manquantes].sort()).toEqual(['analyse technique', 'audit sémantique'])
  })

  it('ignore l’intitulé du poste lui-même et les doublons', () => {
    const c = analyserCouverture(profil, { ...analyse, motsCles: ['matomo', 'Matomo', 'Consultant SEO'] })
    const tous = [...c.attestees, ...c.manquantes].map((t) => t.toLowerCase())
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
  const offre: Offre = {
    titrePoste: 'Consultant SEO (H/F)',
    texteBrut: 'Google Search Console, Ahrefs, Matomo, WordPress.',
  }
  const moteur = () =>
    new MoteurMock({
      motsCles: { motsCles: analyse.motsCles, competencesRequises: analyse.competencesRequises },
      pertinence: {},
      accroche: { accroche: '' },
    })

  it('n’ajoute jamais d’elle-même une compétence absente du profil', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    expect(cv.titre).toBe('Consultant SEO')
    expect(cv.demandees.attestees).toContain('Google Search Console')
    expect(cv.competences).not.toContain('Ahrefs')
    expect(cv.competences).not.toContain('Sens de la pédagogie')
    expect([...cv.demandees.manquantes].sort()).toEqual(['Ahrefs', 'Sens de la pédagogie'])
  })

  it('les compétences demandées absentes sont proposées cochées, et ne restent que si l’utilisateur les garde', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    const points = [cv.experiences[0]?.points ?? []]

    // Par défaut le CV colle à l'offre : tout est coché, formulé comme l'offre.
    const choix = choixInitial(cv)
    expect(choix.ajouterDemandees.every(Boolean)).toBe(true)
    const colle = composerCv(profil, cv, choix, points)
    expect(colle.competencesCles).toEqual(expect.arrayContaining(['Ahrefs', 'Sens de la pédagogie']))
    expect(colle.demandees).toEqual({ attestees: [], manquantes: [] })

    // L'utilisateur décoche ce qu'il ne maîtrise pas.
    choix.ajouterDemandees = cv.demandees.manquantes.map((t) => t === 'Ahrefs')
    const final = composerCv(profil, cv, choix, points)
    expect(final.competencesCles).toContain('Ahrefs')
    expect(final.competencesCles).not.toContain('Sens de la pédagogie')
  })

  it('le schéma accepte un CV ancien sans « demandees »', () => {
    const ancien = cvAdapteSchema.parse({ titre: 'Dev', accroche: '' })
    expect(ancien.demandees).toEqual({ attestees: [], manquantes: [] })
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
