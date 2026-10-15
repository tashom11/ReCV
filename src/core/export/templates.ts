// CV templates: one structure (standard section titles, real text) dressed in several styles.
// No template uses tables, text in images or letter spacing (which makes recruiting software, ATS, read
// « p r o f i l »). The « sidebar » templates put skills and languages in a side column in the PDF; in the HTML
// code, the main content comes first: the reading order is the same.
// The optional photo is a decorative image, ignored by that software.

export const TEMPLATE_IDS = [
  'classic',
  'modern',
  'elegant',
  'banner',
  'sidebar',
  'pastel',
  'capsule',
  'editorial',
  'timeline',
] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface CvTemplate {
  id: TemplateId
  /** Colour swatch of the template (preview in the gallery). */
  color: string
  /** `lateral`: skills and languages in a side column (PDF); the DOCX stays single-column. */
  layout: 'single' | 'sidebar'
  /** DOCX rendering tokens (HTML/PDF uses `css`). */
  docx: {
    font: string
    /** Hexadecimal accent colour without « # » (section titles, name). */
    accent: string
    /** Body text colour. */
    text: string
    header: 'left' | 'center'
    /** Header on a coloured background (name in white). */
    banner?: string
    coloredSectionTitles: boolean
  }
  css: string
}

// Common base: A4 layout with margins set by @page (print) or by the body (screen preview).
const BASE = `
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  @media screen { body { padding: 14mm 16mm; } }
  body { font-size: 10.5pt; line-height: 1.42; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  p { margin: 0; }
  ul { margin: 3pt 0 0; padding-left: 16pt; }
  li { margin: 1pt 0; }
  .competences { columns: 3; column-gap: 14pt; }
  .competences li { break-inside: avoid; }
  h1, h2, h3 { margin: 0; }
  .entete { display: flex; align-items: center; gap: 14pt; }
  .identite { flex: 1; min-width: 0; }
  .photo { width: 28mm; height: 28mm; object-fit: cover; flex: none; }
  .contact span + span::before { content: '  |  '; white-space: pre; }
  section { break-inside: auto; }
  h3, .meta { break-after: avoid; }
`

const CLASSIC = `
  body { font-family: Arial, Helvetica, sans-serif; }
  h1 { font-size: 22pt; }
  .titre-poste { font-size: 12pt; margin-top: 2pt; }
  .contact { margin-top: 4pt; color: #333; }
  .photo { order: 2; border-radius: 3pt; }
  h2 { font-size: 11.5pt; text-transform: uppercase; border-bottom: 1px solid #111; margin: 14pt 0 6pt; padding-bottom: 2pt; }
  h3 { font-size: 10.5pt; margin-top: 8pt; }
  .meta { color: #333; }
`

const MODERN = `
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; }
  h1 { font-size: 26pt; font-weight: 700; }
  .titre-poste { font-size: 13pt; color: #2563eb; font-weight: 600; margin-top: 2pt; }
  .contact { margin-top: 5pt; color: #4b5563; font-size: 9.5pt; }
  .photo { border-radius: 50%; border: 2pt solid #2563eb; }
  h2 { font-size: 10.5pt; text-transform: uppercase; color: #2563eb; border-bottom: 2pt solid #2563eb; margin: 16pt 0 7pt; padding-bottom: 3pt; }
  h3 { font-size: 11pt; margin-top: 9pt; color: #111827; }
  .meta { color: #6b7280; font-size: 9.5pt; }
  li::marker { color: #2563eb; }
`

const ELEGANT = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a2a2a; }
  .entete { flex-direction: column; text-align: center; gap: 8pt; padding-bottom: 10pt; border-bottom: 0.75pt solid #c9b99a; }
  .photo { order: -1; border-radius: 50%; width: 30mm; height: 30mm; border: 1pt solid #c9b99a; }
  h1 { font-size: 24pt; font-weight: 400; text-transform: uppercase; }
  .titre-poste { font-size: 12pt; font-style: italic; color: #7a5c2e; margin-top: 3pt; }
  .contact { margin-top: 5pt; color: #555; font-size: 9.5pt; }
  h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; color: #7a5c2e; text-align: center; border-bottom: 0.5pt solid #c9b99a; margin: 16pt 0 7pt; padding-bottom: 3pt; }
  h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { font-style: italic; color: #555; }
`

const BANNER = `
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .entete { background: #0f172a; color: #fff; margin: -14mm -16mm 8mm; padding: 14mm 16mm 9mm; }
  .entete h1 { font-size: 26pt; font-weight: 700; }
  .titre-poste { font-size: 12.5pt; color: #38bdf8; font-weight: 600; margin-top: 3pt; }
  .contact { margin-top: 6pt; color: #cbd5e1; font-size: 9.5pt; }
  .photo { order: 2; border-radius: 50%; border: 2pt solid #38bdf8; }
  h2 { font-size: 10.5pt; text-transform: uppercase; color: #0f172a; border-left: 3pt solid #38bdf8; padding-left: 7pt; margin: 15pt 0 7pt; }
  h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { color: #64748b; font-size: 9.5pt; }
`

// Sidebar templates: the column background is painted by the page background (repeated on every printed page);
// vertical margins come from @page, horizontal ones from the columns.
const SIDEBAR_BASE = `
  @page { size: A4; margin: 12mm 0; }
  @media screen { body { padding: 12mm 0; } }
  .colonnes { display: flex; flex-direction: row-reverse; align-items: flex-start; }
  .principal { flex: 1; min-width: 0; padding: 0 12mm 0 9mm; }
  .lateral { width: 68mm; flex: none; padding: 0 7mm; }
  .entete { display: block; }
  .principal .entete { margin-bottom: 4pt; }
  .photo { display: block; width: 38mm; height: 38mm; border-radius: 50%; margin: 0 auto 10pt; }
  .lateral h2 { margin: 14pt 0 5pt; padding-bottom: 3pt; }
  .lateral h3 { margin: 7pt 0 2pt; }
  .lateral ul { margin: 0; padding-left: 13pt; }
  .lateral p + p { margin-top: 4pt; }
  .contact { display: block; }
  .contact span { display: block; overflow-wrap: anywhere; }
  .contact span + span::before { content: none; }
`

const SIDEBAR = `
  html { background: linear-gradient(to right, #1e293b 68mm, #fff 68mm); }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  h1 { font-size: 26pt; font-weight: 700; line-height: 1.1; color: #0f172a; }
  .titre-poste { font-size: 13pt; color: #0e7490; font-weight: 600; margin-top: 4pt; }
  .principal h2 { font-size: 11pt; text-transform: uppercase; color: #0f172a; border-bottom: 2pt solid #0e7490; margin: 16pt 0 6pt; padding-bottom: 2pt; }
  .principal h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { color: #64748b; font-size: 9.5pt; }
  .lateral { color: #e2e8f0; font-size: 9.5pt; }
  .lateral h2 { font-size: 10.5pt; text-transform: uppercase; color: #fff; border-bottom: 1pt solid #5eead4; }
  .lateral h3 { font-size: 9.5pt; color: #5eead4; font-weight: 600; }
  .lateral .contact { color: #e2e8f0; }
  .photo { border: 2pt solid #5eead4; }
`

const PASTEL = `
  html { background: linear-gradient(to right, #f3ece2 68mm, #fff 68mm); }
  body { font-family: Georgia, 'Times New Roman', serif; color: #3b3330; }
  h1 { font-size: 26pt; font-weight: 400; line-height: 1.1; text-transform: uppercase; color: #3b3330; }
  .titre-poste { font-size: 12.5pt; font-style: italic; color: #b4532a; margin-top: 4pt; }
  .principal h2 { font-size: 11pt; text-transform: uppercase; color: #b4532a; border-bottom: 0.75pt solid #d9c7b0; margin: 16pt 0 6pt; padding-bottom: 2pt; }
  .principal h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { font-style: italic; color: #7a6b60; font-size: 9.5pt; }
  .lateral { color: #3b3330; font-size: 9.5pt; }
  .lateral h2 { font-size: 10.5pt; text-transform: uppercase; color: #b4532a; border-bottom: 0.75pt solid #d9c7b0; }
  .lateral h3 { font-size: 9.5pt; color: #7a6b60; font-style: italic; font-weight: 400; }
  .photo { border: 2pt solid #fff; box-shadow: 0 0 0 1pt #d9c7b0; }
`

// Capsule: the side column is a rounded « pill » floating on the page, with the photo at its top.
const CAPSULE = `
  @page { size: A4; margin: 10mm 0; }
  @media screen { body { padding: 10mm 0; } }
  body { font-family: 'Trebuchet MS', 'Segoe UI', Arial, sans-serif; color: #23312a; }
  .colonnes { padding-left: 9mm; }
  .lateral { width: 66mm; padding: 12mm 8mm 30mm; background: #e6eee6; border-radius: 33mm; box-decoration-break: clone; -webkit-box-decoration-break: clone; font-size: 9.5pt; }
  .principal { padding: 4mm 12mm 0 10mm; }
  h1 { font-size: 27pt; font-weight: 800; line-height: 1.05; text-transform: uppercase; color: #1d3a2c; }
  .titre-poste { font-size: 12pt; color: #2f6f57; font-weight: 600; margin-top: 5pt; }
  .principal h2 { font-size: 13pt; font-weight: 800; text-transform: uppercase; color: #1d3a2c; margin: 17pt 0 7pt; }
  .principal h3 { font-size: 10.5pt; margin-top: 9pt; }
  .meta { color: #55645b; font-size: 9.5pt; }
  .lateral h2 { font-size: 11.5pt; font-weight: 800; text-transform: uppercase; color: #1d3a2c; margin: 15pt 0 6pt; }
  .lateral h3 { font-size: 9.5pt; font-weight: 700; color: #2f6f57; }
  .photo { width: 40mm; height: 40mm; border: 3pt solid #fff; box-shadow: 0 0 0 0.75pt #cddccd; }
`

// Editorial: black and white, rules between the sections, square photo, contact details in a column on the right.
const EDITORIAL = `
  body { font-family: Helvetica, Arial, sans-serif; color: #151515; }
  .entete { align-items: flex-start; gap: 7mm; padding-bottom: 6pt; }
  .photo { order: -1; width: 32mm; height: 32mm; border-radius: 0; }
  .identite { display: grid; grid-template-columns: 1fr auto; column-gap: 8mm; align-items: start; }
  h1 { grid-column: 1; font-size: 24pt; font-weight: 800; line-height: 1.1; text-transform: uppercase; }
  .titre-poste { grid-column: 1; font-size: 11pt; text-transform: uppercase; color: #444; margin-top: 6pt; }
  .contact { grid-column: 2; grid-row: 1 / span 2; margin-top: 0; font-size: 9pt; color: #222; }
  .contact span { display: block; }
  .contact span + span::before { content: none; }
  h2 { font-size: 10.5pt; font-weight: 800; text-transform: uppercase; border-top: 0.75pt solid #151515; padding-top: 6pt; margin: 14pt 0 6pt; }
  h3 { font-size: 10pt; text-transform: uppercase; margin-top: 8pt; }
  .meta { color: #555; font-size: 9.5pt; }
`

// Timeline: soft greys, a line after each section title, experiences on a vertical line with a dot per entry.
const TIMELINE = `
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #2b3440; }
  .entete { gap: 8mm; padding-bottom: 6pt; }
  .photo { order: -1; width: 34mm; height: 34mm; border-radius: 50%; border: 4pt solid #cfd4da; }
  h1 { font-size: 25pt; font-weight: 700; line-height: 1.1; text-transform: uppercase; }
  .titre-poste { font-size: 13pt; color: #5b6673; margin-top: 3pt; }
  .contact { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 10pt; margin-top: 8pt; font-size: 9.5pt; color: #3b4652; }
  .contact span + span::before { content: none; }
  h2 { display: flex; align-items: center; gap: 10pt; font-size: 13pt; font-weight: 700; margin: 16pt 0 7pt; }
  h2::after { content: ''; flex: 1; border-top: 0.75pt solid #cfd4da; }
  h3 { font-size: 10.5pt; margin-top: 8pt; }
  section > div { position: relative; margin-left: 3pt; padding-left: 12pt; border-left: 1.25pt solid #cfd4da; }
  section > div > h3 { margin-top: 0; padding-top: 6pt; font-size: 10.5pt; }
  section > div > h3::before { content: ''; position: absolute; left: -4.5pt; top: 10.5pt; width: 6pt; height: 6pt; border-radius: 50%; background: #fff; border: 1.5pt solid #2b3440; }
  .meta { color: #5b6673; font-size: 9.5pt; }
`

export const CV_TEMPLATES: readonly CvTemplate[] = [
  {
    id: 'classic',
    color: '#111111',
    layout: 'single',
    docx: { font: 'Calibri', accent: '111111', text: '111111', header: 'left', coloredSectionTitles: false },
    css: BASE + CLASSIC,
  },
  {
    id: 'modern',
    color: '#2563eb',
    layout: 'single',
    docx: { font: 'Calibri', accent: '2563EB', text: '1F2937', header: 'left', coloredSectionTitles: true },
    css: BASE + MODERN,
  },
  {
    id: 'elegant',
    color: '#7a5c2e',
    layout: 'single',
    docx: { font: 'Georgia', accent: '7A5C2E', text: '2A2A2A', header: 'center', coloredSectionTitles: true },
    css: BASE + ELEGANT,
  },
  {
    id: 'banner',
    color: '#0f172a',
    layout: 'single',
    docx: {
      font: 'Calibri',
      accent: '0F172A',
      text: '1E293B',
      header: 'left',
      banner: '0F172A',
      coloredSectionTitles: true,
    },
    css: BASE + BANNER,
  },
  {
    id: 'sidebar',
    color: '#1e293b',
    layout: 'sidebar',
    docx: { font: 'Calibri', accent: '0E7490', text: '1E293B', header: 'left', coloredSectionTitles: true },
    css: BASE + SIDEBAR_BASE + SIDEBAR,
  },
  {
    id: 'pastel',
    color: '#e7d8c4',
    layout: 'sidebar',
    docx: { font: 'Georgia', accent: 'B4532A', text: '3B3330', header: 'left', coloredSectionTitles: true },
    css: BASE + SIDEBAR_BASE + PASTEL,
  },
  {
    id: 'capsule',
    color: '#2f6f57',
    layout: 'sidebar',
    docx: { font: 'Calibri', accent: '2F6F57', text: '23312A', header: 'left', coloredSectionTitles: true },
    css: BASE + SIDEBAR_BASE + CAPSULE,
  },
  {
    id: 'editorial',
    color: '#444444',
    layout: 'single',
    docx: { font: 'Arial', accent: '151515', text: '151515', header: 'left', coloredSectionTitles: false },
    css: BASE + EDITORIAL,
  },
  {
    id: 'timeline',
    color: '#5b6673',
    layout: 'single',
    docx: { font: 'Calibri', accent: '3B4A5A', text: '2B3440', header: 'left', coloredSectionTitles: true },
    css: BASE + TIMELINE,
  },
]

export const DEFAULT_TEMPLATE: TemplateId = 'classic'

export function findTemplate(id: string | undefined): CvTemplate {
  return CV_TEMPLATES.find((m) => m.id === id) ?? (CV_TEMPLATES[0] as CvTemplate)
}
