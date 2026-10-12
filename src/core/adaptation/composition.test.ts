import { describe, expect, it } from 'vitest'
import { type CvAdapte, cvAdapteSchema, type Profil } from '../schemas'
import { choixInitial, composerCv } from './composition'

const profil: Profil = {
  titrePoste: 'Développeur web / Carrossier peintre',
  accroche: 'Accroche d’origine',
  liensProfessionnels: [],
  experiences: [
    { poste: 'Développeur web', entreprise: 'Webagence', realisations: ['Intégration HTML'] },
    { poste: 'Carrossier peintre', entreprise: 'Dupont', realisations: ['Ponçage', 'Peinture'] },
  ],
  competences: ['HTML', 'Rigueur', 'Sens du détail'],
  formations: [
    { diplome: 'BAC +2', etablissement: 'École du Code' },
    { diplome: 'BAC PRO', etablissement: 'Lycée Jean Moulin' },
  ],
  langues: [],
}

const adapte: CvAdapte = cvAdapteSchema.parse({
  titre: 'Carrossier peintre',
  accroche: 'Carrossier rigoureux.',
  experiences: [{ indice: 1, poste: 'Carrossier peintre', entreprise: 'Dupont', points: ['Ponçage soigné'] }],
  competences: ['Rigueur', 'Sens du détail'],
  formations: [{ diplome: 'BAC PRO', etablissement: 'Lycée Jean Moulin' }],
  ecartes: {
    experiences: [{ indice: 0, poste: 'Développeur web', entreprise: 'Webagence', points: ['Intégration HTML'] }],
    competences: ['HTML'],
    formations: [{ diplome: 'BAC +2', etablissement: 'École du Code' }],
  },
})

describe('composerCv', () => {
  it('par défaut, le CV ne contient que le sélection adaptée et vide « ecartes »', () => {
    const cv = composerCv(profil, adapte, choixInitial(adapte), [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.entreprise)).toEqual(['Dupont'])
    expect(cv.competences).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.formations.map((f) => f.diplome)).toEqual(['BAC PRO'])
    expect(cv.ecartes).toEqual({ experiences: [], competences: [], formations: [] })
  })

  it('réintègre ce que l’utilisateur choisit, dans l’ordre du profil, avec les points d’origine', () => {
    const choix = choixInitial(adapte)
    choix.reintegrer.experiences = [true]
    choix.reintegrer.competences = [true]
    choix.reintegrer.formations = [true]
    const cv = composerCv(profil, adapte, choix, [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.entreprise)).toEqual(['Webagence', 'Dupont'])
    expect(cv.experiences[0]?.points).toEqual(['Intégration HTML'])
    expect(cv.competences).toEqual(['Rigueur', 'Sens du détail', 'HTML'])
    expect(cv.formations.map((f) => f.diplome)).toEqual(['BAC +2', 'BAC PRO'])
  })

  it('refuser les points adaptés restaure les réalisations de la bonne expérience (via indice)', () => {
    const choix = choixInitial(adapte)
    choix.experiences = [false]
    const cv = composerCv(profil, adapte, choix, [['Ponçage soigné']])
    expect(cv.experiences[0]?.points).toEqual(['Ponçage', 'Peinture'])
  })

  it('retire les lignes vides des points édités à la main', () => {
    const cv = composerCv(profil, adapte, choixInitial(adapte), [['  Point  ', '', '   ']])
    expect(cv.experiences[0]?.points).toEqual(['Point'])
  })

  it('décocher la sélection de compétences restaure toutes celles du profil', () => {
    const choix = choixInitial(adapte)
    choix.competences = false
    expect(composerCv(profil, adapte, choix, [['x']]).competences).toEqual(profil.competences)
  })
})
