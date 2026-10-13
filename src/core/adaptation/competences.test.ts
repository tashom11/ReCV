import { describe, expect, it } from 'vitest'
import { construireModele } from '../export/modele'
import { assainirProfil } from '../llm/assainissement'
import { MoteurMock } from '../llm/moteurMock'
import type { Offre, Profil } from '../schemas'
import { cvAdapteSchema } from '../schemas'
import {
  eclaterCompetences,
  estCompetenceCourte,
  estSavoirEtre,
  formaterCompetence,
  separerCompetences,
} from './competences'
import { adapterCv } from './pipeline'

describe('estCompetenceCourte', () => {
  it('accepte des termes, refuse les phrases d’activités', () => {
    for (const ok of [
      'Rigueur',
      'WordPress / CMS',
      'Gestion & créa. de landing pages',
      'Capacité d’apprentissage rapide',
    ]) {
      expect(estCompetenceCourte(ok)).toBe(true)
    }
    for (const phrase of [
      'Installation et maintenance de matériel informatique',
      'Support et assistance technique aux utilisateurs',
      'Collaboration avec l’équipe design pour transformer des maquettes en sites web interactifs et responsives',
      'Tests, correction de bugs et optimisation des performances.',
    ]) {
      expect(estCompetenceCourte(phrase)).toBe(false)
    }
  })
})

describe('savoir-être et mise en forme', () => {
  it('reconnaît les qualités transversales, y compris avec apostrophe typographique', () => {
    for (const c of [
      'Rigueur',
      'Autonomie',
      'Travail en équipe',
      'Sens du détail',
      'Capacité d’apprentissage rapide',
      'Esprit d’équipe',
    ]) {
      expect(estSavoirEtre(c)).toBe(true)
    }
    for (const c of ['WordPress / CMS', 'HTML / CSS', 'Google Tag Manager', 'Permis : B']) {
      expect(estSavoirEtre(c)).toBe(false)
    }
    expect(separerCompetences(['Rigueur', 'SEO', 'Autonomie'])).toEqual({
      savoirEtre: ['Rigueur', 'Autonomie'],
      techniques: ['SEO'],
    })
  })

  it('met une majuscule en tête et éclate les listes de termes courts', () => {
    expect(formaterCompetence('  création   digitale ')).toBe('Création digitale')
    expect(eclaterCompetences(['SEO, RGAA, LLM, CRM'])).toEqual(['SEO', 'RGAA', 'LLM', 'CRM'])
    // Éléments trop longs pour être des termes : la liste est conservée telle quelle (puis filtrée comme phrase).
    const longue = 'Création de contenus éditoriaux et multimédias, supports numériques associés aux sites internet'
    expect(eclaterCompetences([longue])).toEqual([longue])
  })
})

describe('extraction : les phrases ne deviennent pas des compétences', () => {
  const cv = 'Compétences : Rigueur, SEO, RGAA. Installation et maintenance de matériel informatique.'
  const profil: Profil = {
    liensProfessionnels: [],
    experiences: [],
    competences: ['Rigueur', 'SEO, RGAA', 'Installation et maintenance de matériel informatique.'],
    formations: [],
    langues: [],
  }

  it('retire les phrases et éclate les listes', () => {
    expect(assainirProfil(profil, cv).competences).toEqual(['Rigueur', 'SEO', 'RGAA'])
  })
})

describe('adapterCv : profil dont les compétences contiennent des phrases', () => {
  const profil: Profil = {
    liensProfessionnels: [],
    titrePoste: 'Technicien informatique',
    experiences: [
      {
        poste: 'Développeur web',
        entreprise: 'Webagence',
        realisations: ['Intégration HTML et CSS', 'Collaboration avec l’équipe design'],
      },
    ],
    competences: [
      'Rigueur',
      'Autonomie',
      'WordPress',
      'Collaboration avec les équipes design et back-end pour garantir la qualité des projets livrés.',
      'Installation et maintenance de matériel informatique',
    ],
    formations: [],
    langues: [],
  }
  const offre: Offre = {
    titrePoste: 'Chargé(e) de création digitale (H/F)',
    texteBrut: 'Création de contenus, collaboration avec le design, webmastering WordPress.',
  }
  const moteur = () =>
    new MoteurMock({
      motsCles: {
        motsCles: ['WordPress', 'création de contenus', 'webmastering'],
        competencesRequises: ['Collaboration avec le design'],
      },
      // Le modèle ne retient que le terme technique : les savoir-être doivent être gardés quand même.
      pertinence: { competencesUtiles: [2] },
      accroche: { accroche: '' },
    })

  it('ne garde que des compétences courtes, savoir-être conservés', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    const toutes = [...cv.competencesCles, ...cv.competences]
    expect(toutes.every(estCompetenceCourte)).toBe(true)
    expect(cv.competences).toEqual(expect.arrayContaining(['Rigueur', 'Autonomie']))
    expect(toutes.join(' ')).not.toMatch(/maintenance|back-end/)
  })

  it('place en compétences clés celles que demande l’offre et que le profil atteste', async () => {
    const cv = await adapterCv(moteur(), profil, offre)
    expect(cv.competencesCles).toEqual(expect.arrayContaining(['WordPress']))
    // Pas de doublon entre compétences clés et autres compétences.
    expect(cv.competences).not.toContain('WordPress')
  })

  it('l’export structure les compétences en lignes étiquetées', async () => {
    const cv = cvAdapteSchema.parse({
      titre: 'Chargé de création digitale',
      accroche: '',
      competencesCles: ['WordPress', 'Création de contenus'],
      competences: ['Rigueur', 'Autonomie', 'HTML / CSS'],
    })
    const modele = construireModele(profil, cv)
    const section = modele.sections.find((s) => s.titre === 'Compétences')
    expect(section?.blocs).toEqual([
      { type: 'paragraphe', texte: 'Compétences clés : WordPress, Création de contenus' },
      { type: 'paragraphe', texte: 'Savoir-être : Rigueur, Autonomie' },
      { type: 'paragraphe', texte: 'Outils et techniques : HTML / CSS' },
    ])
  })
})
