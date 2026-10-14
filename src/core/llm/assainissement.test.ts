import { describe, expect, it } from 'vitest'
import type { Profile } from '../schemas'
import { assainirProfil } from './assainissement'

const CV = `MOREAU Julien
Développeur web / Carrossier peintre
julien.moreau@exemple.fr | 06.00.00.00.01 | Douai
COMPÉTENCES
Rigueur, Autonomie, HTML / CSS, SEO, Permis : B
EXPÉRIENCE PROFESSIONNELLE
DÉVELOPPEUR WEB FRONT
Agence Pixel | 2021-2022
Développement d'interfaces web responsives
CARROSSIER PEINTRE
Carrosserie Dupont | 2016 - 2020
FORMATION
BAC PRO
Lycée Jean Moulin, Douai | 2015
LANGUES
Français, Anglais
Permis : B - Disponibilités : Immédiatement - Site : julien-moreau.exemple.dev`

const base: Profile = {
  fullName: 'Julien Moreau',
  email: 'julien.moreau@exemple.fr',
  phone: '06.00.00.00.01',
  links: [],
  headline: 'Développeur web / Carrossier peintre',
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Agence Pixel',
      dateRange: '2021-2022',
      achievements: ['Développement d’interfaces web responsives'],
    },
    {
      position: 'Carrossier peintre',
      company: 'Carrosserie Dupont',
      dateRange: '2016 - 2020',
      achievements: [],
    },
  ],
  skills: ['Rigueur', 'Autonomie', 'HTML / CSS', 'SEO', 'Permis : B'],
  education: [{ degree: 'BAC PRO', school: 'Lycée Jean Moulin, Douai', dateRange: '2015' }],
  languages: [{ name: 'Français' }, { name: 'Anglais' }],
}

describe('assainirProfil', () => {
  it('conserve un profil entièrement attesté dans le CV', () => {
    expect(assainirProfil(base, CV)).toEqual(base)
  })

  it('ne garde pour liens que de vraies adresses web, pas des noms d’entreprises', () => {
    const profil: Profile = {
      ...base,
      links: ['Agence Pixel', 'Carrosserie Dupont', 'julien-moreau.exemple.dev', 'https://github.com/x'],
    }
    expect(assainirProfil(profil, CV).links).toEqual(['julien-moreau.exemple.dev', 'https://github.com/x'])
  })

  it('retire un diplôme rangé à tort dans les expériences', () => {
    const profil: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        { position: 'BAC PRO', company: 'Lycée Jean Moulin', dateRange: '2015', achievements: [] },
      ],
    }
    expect(assainirProfil(profil, CV).experiences).toEqual(base.experiences)
  })

  it('retire la « expérience » faite d’une ligne diverse (permis, disponibilité, site)', () => {
    const profil: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          position: '',
          company: '',
          description: 'Permis : B - Disponibilités : Immédiatement - Site : julien-moreau.exemple.dev',
          achievements: [],
        },
      ],
    }
    expect(assainirProfil(profil, CV).experiences).toHaveLength(2)
  })

  it('retire une expérience sans entreprise ni période (poste tiré d’une compétence)', () => {
    const profil: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          position: 'Installation et maintenance de matériel informatique.',
          company: '',
          description: 'Support et assistance technique aux utilisateurs.',
          achievements: ['Diagnostic et résolution d’incidents'],
        },
      ],
    }
    expect(assainirProfil(profil, CV).experiences.map((e) => e.company)).toEqual([
      'Agence Pixel',
      'Carrosserie Dupont',
    ])
  })

  it('retire une expérience dont l’entreprise ou le poste n’apparaît pas dans le CV', () => {
    const profil: Profile = {
      ...base,
      experiences: [
        ...base.experiences,
        { position: 'Chef de projet', company: 'Société Fantôme', dateRange: '2018', achievements: [] },
      ],
    }
    expect(assainirProfil(profil, CV).experiences).toHaveLength(2)
  })

  it('retire formations, langues, compétences, e-mail et téléphone inventés', () => {
    const profil: Profile = {
      ...base,
      email: 'inconnu@exemple.fr',
      phone: '07 11 22 33 44',
      education: [...base.education, { degree: 'Master de physique quantique', school: 'MIT' }],
      languages: [...base.languages, { name: 'Japonais' }],
      skills: [...base.skills, 'Kubernetes', 'rigueur'],
    }
    const net = assainirProfil(profil, CV)
    expect(net.email).toBeUndefined()
    expect(net.phone).toBeUndefined()
    expect(net.education).toHaveLength(1)
    expect(net.languages.map((l) => l.name)).toEqual(['Français', 'Anglais'])
    expect(net.skills).toEqual(base.skills)
  })

  it('tolère les artefacts d’extraction PDF (retours à la ligne, tirets, casse, accents)', () => {
    const cvPdf = 'AGENCE\nPIXEL\nDEVELOPPEUR WEB\nFRONT 2021-2022'
    const profil: Profile = {
      links: [],
      experiences: [
        { position: 'Développeur web front', company: 'Agence Pixel', dateRange: '2021-2022', achievements: [] },
      ],
      skills: [],
      education: [],
      languages: [],
    }
    expect(assainirProfil(profil, cvPdf).experiences).toHaveLength(1)
  })
})
