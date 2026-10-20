import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { type Profile, profileSchema } from '../../src/core/schemas'
import { type ExpectedProfile, isSimilar, scoreProfile } from './score'

const expected: ExpectedProfile = {
  fullName: 'Claire Dubois',
  email: 'claire.dubois@exemple.fr',
  phone: '06 12 34 56 78',
  experiences: [
    { position: 'Développeuse front-end', company: 'Société Alpha', dateRange: 'Mars 2021 – présent', bullets: 2 },
    { position: 'Développeuse web junior', company: 'Agence Beta', dateRange: '2019 – 2021', bullets: 1 },
  ],
  education: [{ degree: 'Master Informatique', school: 'Université Fictive' }],
  skills: ['TypeScript', 'React'],
  languages: ['Anglais'],
}

const perfect: Profile = profileSchema.parse({
  fullName: 'Claire Dubois',
  email: 'claire.dubois@exemple.fr',
  phone: '0612345678',
  experiences: [
    {
      position: 'Développeuse front-end',
      company: 'Alpha',
      dateRange: 'Mars 2021 - présent',
      achievements: ['Migration vers TypeScript', 'Tests automatisés'],
    },
    { position: 'Developpeuse web junior', company: 'Agence Beta', dateRange: '2019 – 2021', description: 'Sites' },
  ],
  education: [{ degree: 'Master informatique', school: 'Université Fictive' }],
  skills: ['typescript', 'React'],
  languages: [{ name: 'Anglais', level: 'Courant' }],
})

describe('isSimilar', () => {
  it('ignores case, accents, punctuation and dash styles', () => {
    expect(isSimilar('Mars 2021 – présent', 'mars 2021 - present')).toBe(true)
  })

  it('accepts a whole-word part (« Alpha » / « Société Alpha »)', () => {
    expect(isSimilar('Société Alpha', 'Alpha')).toBe(true)
  })

  it('rejects a fragment of a word or a too short part', () => {
    expect(isSimilar('React', 'Rea')).toBe(false)
    expect(isSimilar('SQL', '')).toBe(false)
  })
})

describe('scoreProfile', () => {
  it('gives 100 % to a profile matching the expected one', () => {
    const score = scoreProfile(perfect, expected)
    expect(score.overall).toBe(1)
    expect(score.dates).toBe(1)
    expect(score.bullets).toBe(1)
  })

  it('gives a low score to an empty extraction (what small models return)', () => {
    const score = scoreProfile(profileSchema.parse({ fullName: 'Claire Dubois' }), expected)
    expect(score.experiences.recall).toBe(0)
    expect(score.skills.recall).toBe(0)
    expect(score.overall).toBeLessThan(0.3)
    // Nothing found: dates and bullets are not measured (not 100 %).
    expect(score.dates).toBeNull()
    expect(score.bullets).toBeNull()
  })

  it('lowers precision for made-up items without lowering recall', () => {
    const score = scoreProfile({ ...perfect, skills: [...perfect.skills, 'Kubernetes', 'Rust'] }, expected)
    expect(score.skills.recall).toBe(1)
    expect(score.skills.precision).toBe(0.5)
  })

  it('counts a duplicated experience only once', () => {
    const first = perfect.experiences[0]
    if (!first) throw new Error('missing experience')
    const score = scoreProfile({ ...perfect, experiences: [first, first] }, expected)
    expect(score.experiences.found).toBe(1)
    expect(score.experiences.precision).toBe(0.5)
  })

  it('measures wrong dates and missing bullets among the experiences found', () => {
    const [first, second] = perfect.experiences
    if (!first || !second) throw new Error('missing experience')
    const score = scoreProfile(
      { ...perfect, experiences: [{ ...first, dateRange: '2021', achievements: ['Migration'] }, second] },
      expected,
    )
    expect(score.dates).toBe(0.5)
    expect(score.bullets).toBe(0.75)
  })
})

describe('benchmark cases', () => {
  it('each CV has a valid expected profile whose facts appear in the CV', async () => {
    const dir = 'fixtures/benchmark'
    const names = (await readdir(dir)).filter((f) => f.endsWith('.txt')).map((f) => f.slice(0, -4))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const text = await readFile(join(dir, `${name}.txt`), 'utf8')
      const expectedCase = JSON.parse(await readFile(join(dir, `${name}.expected.json`), 'utf8')) as ExpectedProfile
      const inCv = (value: string) => isSimilar(value, text) || text.toLowerCase().includes(value.toLowerCase())
      for (const e of expectedCase.experiences) expect(inCv(e.company), `${name}: ${e.company}`).toBe(true)
      for (const e of expectedCase.education) expect(inCv(e.school ?? e.degree), `${name}: ${e.school}`).toBe(true)
    }
  })
})
