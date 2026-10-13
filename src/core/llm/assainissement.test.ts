import { describe, expect, it } from 'vitest'
import type { Profil } from '../schemas'
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

const base: Profil = {
  nom: 'Julien Moreau',
  email: 'julien.moreau@exemple.fr',
  telephone: '06.00.00.00.01',
  liensProfessionnels: [],
  titrePoste: 'Développeur web / Carrossier peintre',
  experiences: [
    {
      poste: 'Développeur web front',
      entreprise: 'Agence Pixel',
      periode: '2021-2022',
      realisations: ['Développement d’interfaces web responsives'],
    },
    {
      poste: 'Carrossier peintre',
      entreprise: 'Carrosserie Dupont',
      periode: '2016 - 2020',
      realisations: [],
    },
  ],
  competences: ['Rigueur', 'Autonomie', 'HTML / CSS', 'SEO', 'Permis : B'],
  formations: [{ diplome: 'BAC PRO', etablissement: 'Lycée Jean Moulin, Douai', periode: '2015' }],
  langues: [{ nom: 'Français' }, { nom: 'Anglais' }],
}

describe('assainirProfil', () => {
  it('conserve un profil entièrement attesté dans le CV', () => {
    expect(assainirProfil(base, CV)).toEqual(base)
  })

  it('retire la « expérience » faite d’une ligne diverse (permis, disponibilité, site)', () => {
    const profil: Profil = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          poste: '',
          entreprise: '',
          description: 'Permis : B - Disponibilités : Immédiatement - Site : julien-moreau.exemple.dev',
          realisations: [],
        },
      ],
    }
    expect(assainirProfil(profil, CV).experiences).toHaveLength(2)
  })

  it('retire une expérience sans entreprise ni période (poste tiré d’une compétence)', () => {
    const profil: Profil = {
      ...base,
      experiences: [
        ...base.experiences,
        {
          poste: 'Installation et maintenance de matériel informatique.',
          entreprise: '',
          description: 'Support et assistance technique aux utilisateurs.',
          realisations: ['Diagnostic et résolution d’incidents'],
        },
      ],
    }
    expect(assainirProfil(profil, CV).experiences.map((e) => e.entreprise)).toEqual([
      'Agence Pixel',
      'Carrosserie Dupont',
    ])
  })

  it('retire une expérience dont l’entreprise ou le poste n’apparaît pas dans le CV', () => {
    const profil: Profil = {
      ...base,
      experiences: [
        ...base.experiences,
        { poste: 'Chef de projet', entreprise: 'Société Fantôme', periode: '2018', realisations: [] },
      ],
    }
    expect(assainirProfil(profil, CV).experiences).toHaveLength(2)
  })

  it('retire formations, langues, compétences, e-mail et téléphone inventés', () => {
    const profil: Profil = {
      ...base,
      email: 'inconnu@exemple.fr',
      telephone: '07 11 22 33 44',
      formations: [...base.formations, { diplome: 'Master de physique quantique', etablissement: 'MIT' }],
      langues: [...base.langues, { nom: 'Japonais' }],
      competences: [...base.competences, 'Kubernetes', 'rigueur'],
    }
    const net = assainirProfil(profil, CV)
    expect(net.email).toBeUndefined()
    expect(net.telephone).toBeUndefined()
    expect(net.formations).toHaveLength(1)
    expect(net.langues.map((l) => l.nom)).toEqual(['Français', 'Anglais'])
    expect(net.competences).toEqual(base.competences)
  })

  it('tolère les artefacts d’extraction PDF (retours à la ligne, tirets, casse, accents)', () => {
    const cvPdf = 'AGENCE\nPIXEL\nDEVELOPPEUR WEB\nFRONT 2021-2022'
    const profil: Profil = {
      liensProfessionnels: [],
      experiences: [
        { poste: 'Développeur web front', entreprise: 'Agence Pixel', periode: '2021-2022', realisations: [] },
      ],
      competences: [],
      formations: [],
      langues: [],
    }
    expect(assainirProfil(profil, cvPdf).experiences).toHaveLength(1)
  })
})
