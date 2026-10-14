// CV templates: one structure (standard section titles, real text) dressed in several styles.
// No template uses tables, text in images or letter spacing (which makes recruiting software, ATS, read
// « p r o f i l »). The « sidebar » templates put skills and languages in a side column in the PDF; in the HTML
// code, the main content comes first: the reading order is the same.
// The optional photo is a decorative image, ignored by that software.

export const TEMPLATE_IDS = ['classique', 'moderne', 'elegant', 'bandeau', 'lateral', 'pastel'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface CvTemplate {
  id: TemplateId
  name: string
  description: string
  /** Colour swatch of the template (preview in the gallery). */
  color: string
  /** `lateral`: skills and languages in a side column (PDF); the DOCX stays single-column. */
  layout: 'simple' | 'lateral'
  /** DOCX rendering tokens (HTML/PDF uses `css`). */
  docx: {
    font: string
    /** Hexadecimal accent colour without « # » (section titles, name). */
    accent: string
    /** Body text colour. */
    text: string
    header: 'gauche' | 'centre'
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

export const CV_TEMPLATES: readonly CvTemplate[] = [
  {
    id: 'classique',
    name: 'Classique',
    description: 'Sobre et neutre, titres soulignés. Le choix le plus universel.',
    color: '#111111',
    layout: 'simple',
    docx: { font: 'Calibri', accent: '111111', text: '111111', header: 'gauche', coloredSectionTitles: false },
    css: BASE + CLASSIC,
  },
  {
    id: 'moderne',
    name: 'Moderne',
    description: 'Accent bleu, nom en grand, photo ronde. Dynamique sans fioriture.',
    color: '#2563eb',
    layout: 'simple',
    docx: { font: 'Calibri', accent: '2563EB', text: '1F2937', header: 'gauche', coloredSectionTitles: true },
    css: BASE + MODERN,
  },
  {
    id: 'elegant',
    name: 'Élégant',
    description: 'Typographie à empattements, en-tête centré, filets fins. Pour les métiers de contact ou de création.',
    color: '#7a5c2e',
    layout: 'simple',
    docx: { font: 'Georgia', accent: '7A5C2E', text: '2A2A2A', header: 'centre', coloredSectionTitles: true },
    css: BASE + ELEGANT,
  },
  {
    id: 'bandeau',
    name: 'Bandeau',
    description: 'En-tête sur fond sombre avec le nom en blanc, rubriques à liseré. Fort impact visuel.',
    color: '#0f172a',
    layout: 'simple',
    docx: {
      font: 'Calibri',
      accent: '0F172A',
      text: '1E293B',
      header: 'gauche',
      banner: '0F172A',
      coloredSectionTitles: true,
    },
    css: BASE + BANNER,
  },
  {
    id: 'lateral',
    name: 'Latéral',
    description: 'Colonne sombre à gauche (photo, contact, compétences, langues), parcours à droite. Style « Canva ».',
    color: '#1e293b',
    layout: 'lateral',
    docx: { font: 'Calibri', accent: '0E7490', text: '1E293B', header: 'gauche', coloredSectionTitles: true },
    css: BASE + SIDEBAR_BASE + SIDEBAR,
  },
  {
    id: 'pastel',
    name: 'Pastel',
    description:
      'Colonne beige à gauche, typographie douce et accents terracotta. Chaleureux, pour les métiers du contact.',
    color: '#e7d8c4',
    layout: 'lateral',
    docx: { font: 'Georgia', accent: 'B4532A', text: '3B3330', header: 'gauche', coloredSectionTitles: true },
    css: BASE + SIDEBAR_BASE + PASTEL,
  },
]

export const DEFAULT_TEMPLATE: TemplateId = 'classique'

export function findTemplate(id: string | undefined): CvTemplate {
  return CV_TEMPLATES.find((m) => m.id === id) ?? (CV_TEMPLATES[0] as CvTemplate)
}
