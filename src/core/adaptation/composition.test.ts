import { describe, expect, it } from 'vitest'
import { type Profile, type TailoredCv, tailoredCvSchema } from '../schemas'
import { choixInitial, composerCv } from './composition'

const profil: Profile = {
  headline: 'Développeur web / Carrossier peintre',
  summary: 'Accroche d’origine',
  links: [],
  experiences: [
    { position: 'Développeur web', company: 'Webagence', achievements: ['Intégration HTML'] },
    { position: 'Carrossier peintre', company: 'Dupont', achievements: ['Ponçage', 'Peinture'] },
  ],
  skills: ['HTML', 'Rigueur', 'Sens du détail'],
  education: [
    { degree: 'BAC +2', school: 'École du Code' },
    { degree: 'BAC PRO', school: 'Lycée Jean Moulin' },
  ],
  languages: [],
}

const adapte: TailoredCv = tailoredCvSchema.parse({
  headline: 'Carrossier peintre',
  summary: 'Carrossier rigoureux.',
  experiences: [{ sourceIndex: 1, position: 'Carrossier peintre', company: 'Dupont', bullets: ['Ponçage soigné'] }],
  skills: ['Rigueur', 'Sens du détail'],
  education: [{ degree: 'BAC PRO', school: 'Lycée Jean Moulin' }],
  excluded: {
    experiences: [{ sourceIndex: 0, position: 'Développeur web', company: 'Webagence', bullets: ['Intégration HTML'] }],
    skills: ['HTML'],
    education: [{ degree: 'BAC +2', school: 'École du Code' }],
  },
})

describe('composerCv', () => {
  it('par défaut, le CV ne contient que le sélection adaptée et vide « ecartes »', () => {
    const cv = composerCv(profil, adapte, choixInitial(adapte), [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.company)).toEqual(['Dupont'])
    expect(cv.skills).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC PRO'])
    expect(cv.excluded).toEqual({ experiences: [], skills: [], education: [] })
  })

  it('réintègre ce que l’utilisateur choisit, dans l’ordre du profil, avec les points d’origine', () => {
    const choix = choixInitial(adapte)
    choix.reintegrer.experiences = [true]
    choix.reintegrer.competences = [true]
    choix.reintegrer.formations = [true]
    const cv = composerCv(profil, adapte, choix, [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.company)).toEqual(['Webagence', 'Dupont'])
    expect(cv.experiences[0]?.bullets).toEqual(['Intégration HTML'])
    expect(cv.skills).toEqual(['Rigueur', 'Sens du détail', 'HTML'])
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC +2', 'BAC PRO'])
  })

  it('refuser les points adaptés restaure les réalisations de la bonne expérience (via indice)', () => {
    const choix = choixInitial(adapte)
    choix.experiences = [false]
    const cv = composerCv(profil, adapte, choix, [['Ponçage soigné']])
    expect(cv.experiences[0]?.bullets).toEqual(['Ponçage', 'Peinture'])
  })

  it('retire les lignes vides des points édités à la main', () => {
    const cv = composerCv(profil, adapte, choixInitial(adapte), [['  Point  ', '', '   ']])
    expect(cv.experiences[0]?.bullets).toEqual(['Point'])
  })

  it('décocher la sélection de compétences restaure toutes celles du profil', () => {
    const choix = choixInitial(adapte)
    choix.competences = false
    expect(composerCv(profil, adapte, choix, [['x']]).skills).toEqual(profil.skills)
  })
})
