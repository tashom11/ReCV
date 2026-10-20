import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type Profile, profileSchema } from '../schemas'
import { completeProfile, readContact, readEducation, readLanguages, readSkills, recoverBullets } from './cvReading'

const fixture = (name: string) => readFileSync(`fixtures/benchmark/${name}.txt`, 'utf8')

describe('readSkills', () => {
  it('splits a list on commas', () => {
    expect(readSkills(fixture('01-classic'))).toEqual([
      'TypeScript',
      'React',
      'Node.js',
      'SQL',
      'Git',
      'Tests automatisés',
    ])
  })

  it('drops the category of « Catégorie : a, b » and keeps parentheses whole', () => {
    const skills = readSkills(fixture('04-dense-skills'))
    expect(skills).toContain('Sage 100')
    expect(skills).toContain('Excel (tableaux croisés dynamiques)')
    expect(skills).toContain('Power BI')
    expect(skills).toContain('rapprochements bancaires')
    expect(skills.some((s) => s.includes(':'))).toBe(false)
  })

  it('joins a list wrapped on two lines and drops the final full stop', () => {
    const skills = readSkills(fixture('03-career-change'))
    expect(skills).toContain('relation client')
    expect(skills).toContain('patience')
    expect(skills.at(-1)).toBe('travail en équipe')
  })

  it('reads bulleted skills, without duplicates', () => {
    expect(readSkills('COMPÉTENCES\n• React\n• SQL\n• react')).toEqual(['React', 'SQL'])
  })

  it('reads nothing without a skills section', () => {
    expect(readSkills(fixture('05-minimal'))).toEqual([])
  })

  it('ignores a line where two columns are glued together by the extraction', () => {
    expect(readSkills('COMPÉTENCES\nCanva EXPÉRIENCES\nSQL')).toEqual(['SQL'])
  })

  it('joins a skill wrapped on two lines in a narrow column, but not a list of lower-case lines', () => {
    expect(readSkills('COMPÉTENCES\nCanva\nCommunity\nmanagement\nRédaction web')).toEqual([
      'Canva',
      'Community management',
      'Rédaction web',
    ])
    expect(readSkills('COMPÉTENCES\nrigueur\nautonomie')).toEqual(['rigueur', 'autonomie'])
  })

  it('drops a skill glued to the dates of the neighbouring column', () => {
    expect(readSkills('COMPÉTENCES\nCommunity management 2020 – 2024\nSQL\nSage 100')).toEqual(['SQL', 'Sage 100'])
  })

  it('keeps only the skill of a line glued to a bullet sentence of the neighbouring column', () => {
    const cv = 'COMPÉTENCES\nRédaction web • Animation des comptes Facebook, Instagram et LinkedIn\nGoogle Analytics'
    expect(readSkills(cv)).toEqual(['Rédaction web', 'Google Analytics'])
  })

  it('still splits a list separated by bullets', () => {
    expect(readSkills('COMPÉTENCES\nPython • SQL • Git')).toEqual(['Python', 'SQL', 'Git'])
  })
})

describe('readLanguages', () => {
  it('reads a language with its level, in every usual notation', () => {
    expect(readLanguages(fixture('01-classic'))).toEqual([
      { name: 'Français', level: 'Langue maternelle' },
      { name: 'Anglais', level: 'Courant' },
    ])
    expect(readLanguages(fixture('06-long'))).toEqual([
      { name: 'Anglais', level: 'courant (TOEIC 905)' },
      { name: 'Espagnol', level: 'scolaire' },
    ])
    expect(readLanguages('LANGUES\nAnglais (B2)\nEspagnol')).toEqual([
      { name: 'Anglais', level: 'B2' },
      { name: 'Espagnol' },
    ])
  })

  it('splits several languages on one line', () => {
    expect(readLanguages(fixture('04-dense-skills')).map((l) => l.name)).toEqual(['Anglais', 'Allemand'])
  })

  it('finds a language quoted with a level outside the languages section', () => {
    expect(readLanguages(fixture('03-career-change'))).toEqual([{ name: 'Anglais', level: 'notions' }])
  })

  it('ignores words that are not languages, and a bare language outside its section', () => {
    expect(readLanguages('LANGUES\nPermis B\nCuisine')).toEqual([])
    expect(readLanguages('AUTRES\nJ’aime l’anglais et le sport. Anglais technique apprécié')).toEqual([])
  })
})

const profileWith = (experiences: unknown[]): Profile => profileSchema.parse({ experiences })

describe('recoverBullets', () => {
  it('takes the bulleted lines under the heading of the experience when the model merged them in the description', () => {
    const profile = profileWith([
      { position: 'Développeuse front-end', company: 'Société Alpha', description: 'Tout en un' },
      { position: 'Développeuse web junior', company: 'Agence Beta', achievements: ['Création de dix sites'] },
    ])
    const [first, second] = recoverBullets(profile, fixture('01-classic')).experiences
    expect(first?.achievements).toEqual([
      "Migration de l'application de JavaScript vers TypeScript",
      'Mise en place de tests automatisés avec Vitest, réduisant les régressions de 30 %',
      'Encadrement de deux stagiaires sur les bonnes pratiques front-end',
    ])
    // The bullets of one experience never leak into the other.
    expect(second?.achievements).toEqual([
      'Création de dix sites WordPress sur mesure',
      'Optimisation du temps de chargement des pages de 40 %',
    ])
  })

  it('keeps the achievements of the model when it found as many', () => {
    const profile = profileWith([
      {
        position: 'Chef de projet informatique',
        company: 'Pi Assurances',
        achievements: ['a', 'b', 'c', 'd'].map((x) => `Réalisation ${x}`),
      },
    ])
    expect(recoverBullets(profile, fixture('06-long')).experiences[0]?.achievements).toHaveLength(4)
  })

  it('stops at the heading of the next section', () => {
    const profile = profileWith([{ position: 'Stagiaire développeur', company: 'Upsilon Informatique' }])
    expect(recoverBullets(profile, fixture('06-long')).experiences[0]?.achievements).toEqual([
      "Développement d'un outil interne de suivi des tickets",
    ])
  })

  it('joins a bullet wrapped on the next line', () => {
    const cv = 'EXPÉRIENCE\nVendeuse — Boulangerie Mu\n2021 – 2024\n- Encaissement et mise\nen rayon\n- Conseil'
    const profile = profileWith([{ position: 'Vendeuse', company: 'Boulangerie Mu' }])
    expect(recoverBullets(profile, cv).experiences[0]?.achievements).toEqual([
      'Encaissement et mise en rayon',
      'Conseil',
    ])
  })

  it('changes nothing for an experience it cannot find or without bullets', () => {
    const profile = profileWith([
      { position: 'Astronaute', company: 'Nulle part' },
      { position: 'Mécanicien automobile', company: 'Garage Zêta' },
    ])
    expect(recoverBullets(profile, fixture('03-career-change'))).toEqual(profile)
  })
})

describe('readContact', () => {
  it('reads the name on the first line, the e-mail and the phone', () => {
    expect(readContact(fixture('01-classic'))).toEqual({
      fullName: 'Claire Dubois',
      email: 'claire.dubois@exemple.fr',
      phone: '06 12 34 56 78',
    })
    expect(readContact(fixture('04-dense-skills')).fullName).toBe('SOPHIE LAMBERT')
    expect(readContact(fixture('03-career-change')).phone).toBe('07 11 22 33 44')
  })

  it('finds an e-mail address in the middle of a line, and none in a text without any', () => {
    expect(readContact('Tél. 06 12 34 56 78 · claire.dubois+cv@exemple.fr, Lyon').email).toBe(
      'claire.dubois+cv@exemple.fr',
    )
    expect(readContact('adresse@ puis un arobase @ seul').email).toBeUndefined()
  })

  it('stays fast on a very long text without spaces or without any « @ »', () => {
    const start = performance.now()
    readContact('x'.repeat(200_000))
    readContact(`${'a@'.repeat(50_000)}b`)
    expect(performance.now() - start).toBeLessThan(1000)
  })

  it('does not take a heading or a sentence for a name', () => {
    expect(readContact('EXPÉRIENCE PROFESSIONNELLE\nVendeuse').fullName).toBeUndefined()
    expect(readContact('Chef de projet informatique depuis dix ans, à Toulouse.').fullName).toBeUndefined()
    expect(readContact('Contact : julien.morel@exemple.fr').fullName).toBeUndefined()
  })
})

describe('completeProfile', () => {
  it('adds the skills and languages the model left out, without duplicating the ones it found', () => {
    const profile = profileSchema.parse({ skills: ['react'], languages: [{ name: 'Anglais' }] })
    const completed = completeProfile(profile, fixture('01-classic'))
    expect(completed.skills.filter((s) => s.toLowerCase() === 'react')).toHaveLength(1)
    expect(completed.skills).toContain('SQL')
    expect(completed.languages.map((l) => l.name)).toEqual(['Anglais', 'Français'])
    // What the model gave keeps its form.
    expect(completed.languages[0]).toEqual({ name: 'Anglais' })
  })
})

describe('readEducation', () => {
  it('reads a degree and its school on one line, without any heading', () => {
    expect(readEducation(fixture('05-minimal'))).toEqual([
      { degree: 'bac pro commerce', school: 'lycée Omicron', dateRange: '2019' },
    ])
    expect(readEducation('2015 – BTS Comptabilité et gestion, Lycée Lambda, Bordeaux')).toEqual([
      { degree: 'BTS Comptabilité et gestion', school: 'Lycée Lambda', dateRange: '2015' },
    ])
  })

  it('needs both a degree at the start of the line and a school', () => {
    expect(readEducation('Master en gestion de projet, 5 ans de pratique')).toEqual([])
    expect(readEducation('Préparation de la licence logicielle à l’université de Lille')).toEqual([])
  })

  it('is only used by completeProfile for a CV without a training heading and an education the model missed', () => {
    const bare = profileSchema.parse({})
    expect(completeProfile(bare, fixture('05-minimal')).education).toHaveLength(1)
    // With a heading, the model is trusted: the reading is not used.
    expect(completeProfile(bare, fixture('01-classic')).education).toEqual([])
    const known = profileSchema.parse({ education: [{ degree: 'BTS', school: 'Lycée' }] })
    expect(completeProfile(known, fixture('05-minimal')).education).toEqual(known.education)
  })
})
