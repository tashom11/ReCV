import { describe, expect, it } from 'vitest'
import { type Profile, type TailoredCv, tailoredCvSchema } from '../schemas'
import { composeCv, initialChoices } from './composition'

const profile: Profile = {
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

const tailored: TailoredCv = tailoredCvSchema.parse({
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

describe('composeCv', () => {
  it('by default, the CV only contains the tailored selection and empties « excluded »', () => {
    const cv = composeCv(profile, tailored, initialChoices(tailored), [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.company)).toEqual(['Dupont'])
    expect(cv.skills).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC PRO'])
    expect(cv.excluded).toEqual({ experiences: [], skills: [], education: [] })
  })

  it('reinstates what the user chooses, in profile order, with the original bullets', () => {
    const choice = initialChoices(tailored)
    choice.reinstate.experiences = [true]
    choice.reinstate.skills = [true]
    choice.reinstate.education = [true]
    const cv = composeCv(profile, tailored, choice, [['Ponçage soigné']])
    expect(cv.experiences.map((e) => e.company)).toEqual(['Webagence', 'Dupont'])
    expect(cv.experiences[0]?.bullets).toEqual(['Intégration HTML'])
    expect(cv.skills).toEqual(['Rigueur', 'Sens du détail', 'HTML'])
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC +2', 'BAC PRO'])
  })

  it('refusing the tailored bullets restores the achievements of the right experience (via sourceIndex)', () => {
    const choice = initialChoices(tailored)
    choice.experiences = [false]
    const cv = composeCv(profile, tailored, choice, [['Ponçage soigné']])
    expect(cv.experiences[0]?.bullets).toEqual(['Ponçage', 'Peinture'])
  })

  it('removes empty lines from hand-edited bullets', () => {
    const cv = composeCv(profile, tailored, initialChoices(tailored), [['  Point  ', '', '   ']])
    expect(cv.experiences[0]?.bullets).toEqual(['Point'])
  })

  it('unticking the skill selection restores all those of the profile', () => {
    const choice = initialChoices(tailored)
    choice.skills = false
    expect(composeCv(profile, tailored, choice, [['x']]).skills).toEqual(profile.skills)
  })
})
