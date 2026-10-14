import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { profileSchema, tailoredCvSchema } from '../schemas'
import { generateHtmlCv } from './CvHtml'
import { buildCvDocument, cvFileName, SECTION_TITLES } from './cvDocument'
import { generateDocxCv } from './docx'

const profile = profileSchema.parse({
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
  const model = buildCvDocument(profile, cv)

  it('ordonne les sections avec des titres standards', () => {
    expect(model.sections.map((s) => s.title)).toEqual([
      SECTION_TITLES.profile,
      SECTION_TITLES.skills,
      SECTION_TITLES.experience,
      SECTION_TITLES.education,
      SECTION_TITLES.languages,
    ])
  })

  it('reprend les coordonnées du profil', () => {
    expect(model.contact).toEqual(['claire@exemple.fr', '06 12 34 56 78', 'Lyon'])
  })

  it('omet les sections vides', () => {
    const vide = buildCvDocument(profile, { ...cv, summary: ' ', skills: [], education: [], languages: [] })
    expect(vide.sections.map((s) => s.title)).toEqual([SECTION_TITLES.experience])
  })

  it('produit un nom de fichier sûr', () => {
    expect(cvFileName(model, 'pdf')).toBe('CV-Claire-Dubois.pdf')
    expect(cvFileName({ ...model, name: 'Éloïse O’Brien / Ñ' }, 'docx')).toBe('CV-Eloise-O-Brien-N.docx')
    expect(cvFileName({ ...model, name: '' }, 'pdf')).toBe('CV.pdf')
  })
})

describe('genererHtmlCv', () => {
  const html = generateHtmlCv(buildCvDocument(profile, cv))

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
    const buffer = await generateDocxCv(buildCvDocument(profile, cv))
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
