import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { profileSchema, tailoredCvSchema } from '../schemas'
import { genererHtmlCv } from './CvHtml'
import { genererDocxCv } from './docx'
import { construireModele, nomFichierCv, TITRES_SECTIONS } from './modele'

const profil = profileSchema.parse({
  fullName: 'Claire Dubois',
  email: 'claire@exemple.fr',
  phone: '06 12 34 56 78',
  location: 'Lyon',
})
const cv = tailoredCvSchema.parse({
  headline: 'Développeuse front-end React',
  summary: 'Cinq ans d’expérience en React & TypeScript <3.',
  experiences: [
    {
      position: 'Développeuse front-end',
      company: 'Société Alpha',
      location: 'Lyon',
      dateRange: '2021 – présent',
      bullets: ['Migration vers TypeScript', 'Tests avec Vitest'],
    },
  ],
  skills: ['React', 'TypeScript'],
  education: [{ degree: 'Master informatique', school: 'Université de Lyon' }],
  languages: [{ name: 'Français', level: 'natif' }],
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
    const vide = construireModele(profil, { ...cv, summary: ' ', skills: [], education: [], languages: [] })
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
