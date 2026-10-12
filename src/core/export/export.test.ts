import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { cvAdapteSchema, profilSchema } from '../schemas'
import { genererHtmlCv } from './CvHtml'
import { genererDocxCv } from './docx'
import { construireModele, nomFichierCv, TITRES_SECTIONS } from './modele'

const profil = profilSchema.parse({
  nom: 'Claire Dubois',
  email: 'claire@exemple.fr',
  telephone: '06 12 34 56 78',
  adresse: 'Lyon',
})
const cv = cvAdapteSchema.parse({
  titre: 'Développeuse front-end React',
  accroche: 'Cinq ans d’expérience en React & TypeScript <3.',
  experiences: [
    {
      poste: 'Développeuse front-end',
      entreprise: 'Société Alpha',
      lieu: 'Lyon',
      periode: '2021 – présent',
      points: ['Migration vers TypeScript', 'Tests avec Vitest'],
    },
  ],
  competences: ['React', 'TypeScript'],
  formations: [{ diplome: 'Master informatique', etablissement: 'Université de Lyon' }],
  langues: [{ nom: 'Français', niveau: 'natif' }],
})

describe('construireModele', () => {
  const modele = construireModele(profil, cv)

  it('ordonne les sections avec des titres standards', () => {
    expect(modele.sections.map((s) => s.titre)).toEqual([
      TITRES_SECTIONS.profil,
      TITRES_SECTIONS.competences,
      TITRES_SECTIONS.experience,
      TITRES_SECTIONS.formation,
      TITRES_SECTIONS.langues,
    ])
  })

  it('reprend les coordonnées du profil', () => {
    expect(modele.contact).toEqual(['claire@exemple.fr', '06 12 34 56 78', 'Lyon'])
  })

  it('omet les sections vides', () => {
    const vide = construireModele(profil, { ...cv, accroche: ' ', competences: [], formations: [], langues: [] })
    expect(vide.sections.map((s) => s.titre)).toEqual([TITRES_SECTIONS.experience])
  })

  it('produit un nom de fichier sûr', () => {
    expect(nomFichierCv(modele, 'pdf')).toBe('CV-Claire-Dubois.pdf')
    expect(nomFichierCv({ ...modele, nom: 'Éloïse O’Brien / Ñ' }, 'docx')).toBe('CV-Eloise-O-Brien-N.docx')
    expect(nomFichierCv({ ...modele, nom: '' }, 'pdf')).toBe('CV.pdf')
  })
})

describe('genererHtmlCv', () => {
  const html = genererHtmlCv(construireModele(profil, cv))

  it('contient le texte réel, sans tableau ni image', () => {
    expect(html).toContain('Claire Dubois')
    expect(html).toContain('Migration vers TypeScript')
    expect(html).not.toMatch(/<table|<img|<svg/)
  })

  it('échappe le contenu', () => {
    expect(html).toContain('&lt;3')
    expect(html).not.toContain('<3.')
  })
})

describe('genererDocxCv', () => {
  it('produit un DOCX relisible contenant les sections et les puces', async () => {
    const buffer = await genererDocxCv(construireModele(profil, cv))
    expect(buffer.subarray(0, 2).toString()).toBe('PK')
    const { value } = await mammoth.extractRawText({ buffer })
    expect(value).toContain('Claire Dubois')
    expect(value).toContain('EXPÉRIENCE PROFESSIONNELLE')
    expect(value).toContain('Tests avec Vitest')
    const html = (await mammoth.convertToHtml({ buffer })).value
    expect(html).toContain('<li>')
    expect(html).not.toContain('<table')
  })
})
