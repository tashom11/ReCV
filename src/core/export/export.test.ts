import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { profileSchema, tailoredCvSchema } from '../schemas'
import { generateHtmlCv } from './CvHtml'
import { buildCvDocument, CV_LABELS, cvFileName } from './cvDocument'
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

describe('buildCvDocument', () => {
  const model = buildCvDocument(profile, cv)

  it('orders the sections with the standard titles of the CV language', () => {
    expect(model.language).toBe('fr')
    expect(model.sections.map((s) => s.id)).toEqual(['profile', 'skills', 'experience', 'education', 'languages'])
    expect(model.sections.map((s) => s.title)).toEqual([
      'Profil',
      'Compétences',
      'Expérience professionnelle',
      'Formation',
      'Langues',
    ])
  })

  it('gives each skill line its label and its terms', () => {
    const skills = buildCvDocument(profile, { ...cv, keySkills: ['React'], skills: ['Rigueur', 'Vitest'] })
    expect(skills.sections.find((s) => s.id === 'skills')?.blocks).toEqual([
      { type: 'labelled-list', label: CV_LABELS.fr.skillLines.key, elements: ['React'] },
      { type: 'labelled-list', label: CV_LABELS.fr.skillLines.soft, elements: ['Rigueur'] },
      { type: 'labelled-list', label: CV_LABELS.fr.skillLines.hard, elements: ['Vitest'] },
    ])
  })

  it('takes the contact details from the profile', () => {
    expect(model.contact).toEqual(['claire@exemple.fr', '06 12 34 56 78', 'Lyon'])
  })

  it('leaves out empty sections', () => {
    const empty = buildCvDocument(profile, { ...cv, summary: ' ', skills: [], education: [], languages: [] })
    expect(empty.sections.map((s) => s.id)).toEqual(['experience'])
  })

  it('produces a safe file name', () => {
    expect(cvFileName(model, 'pdf')).toBe('CV-Claire-Dubois.pdf')
    expect(cvFileName({ ...model, name: 'Éloïse O’Brien / Ñ' }, 'docx')).toBe('CV-Eloise-O-Brien-N.docx')
    expect(cvFileName({ ...model, name: '' }, 'pdf')).toBe('CV.pdf')
  })
})

describe('generateHtmlCv', () => {
  const html = generateHtmlCv(buildCvDocument(profile, cv))

  it('contains real text, without table nor image', () => {
    expect(html).toContain('Claire Dubois')
    expect(html).toContain('Migration vers TypeScript')
    expect(html).not.toMatch(/<table|<img|<svg/)
  })

  it('escapes the content', () => {
    expect(html).toContain('&lt;3')
    expect(html).not.toContain('<3.')
  })
})

describe('generateDocxCv', () => {
  it('produces a readable DOCX with the sections and the bullets', async () => {
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
