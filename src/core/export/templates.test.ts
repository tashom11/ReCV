import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { sanitizeProfile } from '../llm/sanitization'
import { type Profile, profileExtractionSchema, profileSchema, tailoredCvSchema } from '../schemas'
import { generateHtmlCv } from './CvHtml'
import { buildCvDocument } from './cvDocument'
import { generateDocxCv } from './docx'
import { CV_TEMPLATES, findTemplate, TEMPLATE_IDS } from './templates'

// PNG 1×1 transparent.
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const profile: Profile = profileSchema.parse({
  fullName: 'Julien Moreau',
  email: 'julien@exemple.fr',
  photo: PHOTO,
})
const cv = tailoredCvSchema.parse({
  headline: 'Chargé de recrutement',
  summary: 'Je fais preuve d’autonomie.',
  keySkills: ['LinkedIn Recruiter'],
  skills: ['Rigueur', 'HTML / CSS'],
  experiences: [{ position: 'Développeur', company: 'Webagence', dateRange: '2022', bullets: ['Intégration HTML'] }],
  education: [{ degree: 'BAC +2', school: 'École du Code' }],
})

describe('template catalogue', () => {
  it('offers at least three templates, one per id', () => {
    expect(CV_TEMPLATES.length).toBeGreaterThanOrEqual(3)
    expect(CV_TEMPLATES.map((m) => m.id)).toEqual([...TEMPLATE_IDS])
  })

  it('falls back to the classic template for an unknown id', () => {
    expect(findTemplate('inconnu').id).toBe('classic')
    expect(findTemplate(undefined).id).toBe('classic')
  })
})

describe.each(TEMPLATE_IDS)('modèle %s', (id) => {
  const model = buildCvDocument(profile, cv)
  const html = generateHtmlCv(model, id)

  it('stays ATS-friendly: real text, standard titles, no table nor SVG', () => {
    expect(html).not.toMatch(/<table|<svg|<canvas|<script/i)
    if (findTemplate(id).layout === 'sidebar') {
      // Sidebar column: subtitle and list, the main content staying before the column in the code.
      expect(html).toContain('<h3>Compétences clés</h3><ul><li>LinkedIn Recruiter</li>')
      expect(html.indexOf('<h2>Expérience professionnelle</h2>')).toBeLessThan(html.indexOf('<h2>Compétences</h2>'))
    } else {
      expect(html).toContain('Compétences clés : LinkedIn Recruiter')
    }
    expect(html).toContain('<h2>Compétences</h2>')
    expect(html).toContain(`data-template="${id}"`)
  })

  it('never spaces letters out (ATS extraction would read « p r o f i l »)', () => {
    expect(findTemplate(id).css).not.toMatch(/letter-spacing\s*:\s*[^;0]/)
  })

  it('shows no company name among the contact details nor any degree among the experiences', () => {
    const dirty = buildCvDocument(
      { ...profile, links: ['Webagence', 'linkedin.com/in/julien'] },
      {
        ...cv,
        experiences: [...cv.experiences, { position: 'BAC +2', company: '', location: '', dateRange: '', bullets: [] }],
      },
    )
    const rendered = generateHtmlCv(dirty, id)
    expect(rendered).toContain('linkedin.com/in/julien')
    expect(rendered).not.toContain('Webagence</span>')
    expect(rendered.match(/<h3>BAC \+2<\/h3>/g)).toHaveLength(1)
  })

  it('shows the photo when the profile has one, nothing otherwise', () => {
    expect(html).toContain('<img class="photo"')
    const without = generateHtmlCv(buildCvDocument({ ...profile, photo: undefined }, cv), id)
    expect(without).not.toContain('<img')
  })

  it('produces a readable DOCX, with the photo as an image and no table', async () => {
    const buffer = await generateDocxCv(model, id)
    const { value } = await mammoth.extractRawText({ buffer })
    expect(value).toContain('Julien Moreau')
    expect(value).toContain('COMPÉTENCES')
    const rendered = (await mammoth.convertToHtml({ buffer })).value
    expect(rendered).toContain('<img')
    expect(rendered).not.toContain('<table')
  })
})

describe('profile photo', () => {
  it('is never asked of the language model (absent from the extraction schema)', () => {
    expect(Object.keys(profileExtractionSchema.shape)).not.toContain('photo')
    expect(Object.keys(profileSchema.shape)).toContain('photo')
  })

  it('only accepts PNG, JPEG or WebP images', () => {
    expect(profileSchema.safeParse({ photo: PHOTO }).success).toBe(true)
    expect(profileSchema.safeParse({ photo: 'data:text/html;base64,PGgxPg==' }).success).toBe(false)
    expect(profileSchema.safeParse({ photo: 'https://exemple.fr/moi.jpg' }).success).toBe(false)
  })

  it('refuses an oversized image', () => {
    const huge = `data:image/jpeg;base64,${'A'.repeat(310_000)}`
    expect(profileSchema.safeParse({ photo: huge }).success).toBe(false)
  })

  it('sanitising an extracted profile does not make up a photo', () => {
    const extracted = profileExtractionSchema.parse({ fullName: 'Julien' })
    expect(sanitizeProfile(extracted as Profile, 'Julien').photo).toBeUndefined()
  })
})
