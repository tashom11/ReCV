import { describe, expect, it } from 'vitest'
import { versSchemaGrammaire } from '../llm/moteurLocal'
import { MoteurMock } from '../llm/moteurMock'
import type { Experience, Offre, Profil } from '../schemas'
import { analyseOffreSchema } from './motsCles'
import { niveauxCompetences } from './pertinence'
import { adapterCv } from './pipeline'
import { selectionnerPoints } from './reecriture'

const experience: Experience = {
  poste: 'Carrossier peintre',
  entreprise: 'Dupont',
  realisations: [
    'Débosselage et redressage de carrosseries',
    'Application de peintures et vernis',
    'Ponçage et préparation des surfaces',
    'Nettoyage de l’atelier',
    'Gestion du stock de consommables',
  ],
}

describe('selectionnerPoints (sans modèle)', () => {
  it('garde les puces les plus proches de l’offre, dans leur ordre d’origine', () => {
    const retenus = selectionnerPoints(experience, ['ponçage', 'peinture vernis', 'carrosserie'], 3)
    expect(retenus).toEqual([
      'Débosselage et redressage de carrosseries',
      'Application de peintures et vernis',
      'Ponçage et préparation des surfaces',
    ])
  })

  it('renvoie tout si le nombre de puces tient dans la limite, sans rien inventer', () => {
    expect(selectionnerPoints(experience, ['x'], 10)).toEqual(experience.realisations)
  })
})

describe('adapterCv : mode rapide par défaut', () => {
  const profil: Profil = {
    liensProfessionnels: [],
    titrePoste: 'Carrossier peintre',
    experiences: [experience],
    competences: ['Rigueur'],
    formations: [],
    langues: [],
  }
  const offre: Offre = { titrePoste: 'Carrossier peintre', texteBrut: 'Ponçage, peinture et vernis.' }
  const reponses = {
    motsCles: { motsCles: ['ponçage', 'peinture'], competencesRequises: [] },
    pertinence: {},
    accroche: { accroche: '' },
  }

  it('n’appelle pas le modèle pour réécrire les expériences', async () => {
    const m = new MoteurMock(reponses)
    const cv = await adapterCv(m, profil, offre)
    expect(m.requetes.map((r) => r.nom)).toEqual(['motsCles', 'pertinence', 'accroche'])
    expect(cv.experiences[0]?.points.every((p) => experience.realisations.includes(p))).toBe(true)
    expect(cv.experiences[0]?.points).toHaveLength(3)
  })

  it('réutilise une analyse déjà connue (aucun appel « motsCles »)', async () => {
    const m = new MoteurMock(reponses)
    const connue = {
      titreCible: 'Carrossier peintre',
      motsCles: ['ponçage'],
      competencesRequises: [],
      qualites: [],
      formationRequise: '',
      experienceRequise: '',
    }
    await adapterCv(m, profil, offre, { analyse: connue })
    expect(m.requetes.map((r) => r.nom)).not.toContain('motsCles')
  })

  it('signale l’analyse calculée pour qu’elle soit mémorisée', async () => {
    const m = new MoteurMock(reponses)
    let recue: unknown
    await adapterCv(m, profil, offre, { surAnalyse: (a) => (recue = a) })
    expect(recue).toMatchObject({ titreCible: 'Carrossier peintre', motsCles: ['ponçage', 'peinture'] })
  })
})

describe('réponses compactes', () => {
  it('borne la liste des mots-clés dans le schéma (grammaire) et tronque une réponse trop longue', () => {
    const grammaire = JSON.stringify(versSchemaGrammaire(analyseOffreSchema))
    expect(grammaire).toContain('"maxItems":8')
    expect(grammaire).toContain('"maxLength":40')
    const bornee = analyseOffreSchema.parse({ motsCles: Array.from({ length: 30 }, () => 'x'.repeat(100)) })
    expect(bornee.motsCles).toHaveLength(8)
    expect(bornee.motsCles[0]).toHaveLength(40)
  })

  it('convertit les indices utiles en niveaux, sans rien retirer si la liste est vide ou invalide', () => {
    expect(niveauxCompetences([0, 2], 4)).toEqual([1, 0, 1, 0])
    expect(niveauxCompetences([], 3)).toEqual([1, 1, 1])
    expect(niveauxCompetences([9, -1], 3)).toEqual([1, 1, 1])
  })
})
