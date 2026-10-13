// Modèles de CV : une même structure (une colonne, texte réel, titres de section standards) habillée de plusieurs
// styles. Aucun modèle n'utilise de tableau, de colonne latérale ni de texte dans une image : ils restent lisibles
// par les logiciels de recrutement (ATS). La photo, facultative, est une image décorative ignorée par ces logiciels.

export const IDS_MODELES = ['classique', 'moderne', 'elegant', 'bandeau'] as const
export type IdModele = (typeof IDS_MODELES)[number]

export interface ModeleCv {
  id: IdModele
  nom: string
  description: string
  /** Pastille de couleur du modèle (aperçu dans la galerie). */
  couleur: string
  /** Jetons du rendu DOCX (le HTML/PDF utilise `css`). */
  docx: {
    police: string
    /** Couleur d'accent hexadécimale sans « # » (titres de section, nom). */
    accent: string
    /** Couleur du texte courant. */
    texte: string
    entete: 'gauche' | 'centre'
    /** En-tête sur fond coloré (nom en blanc). */
    bandeau?: string
    titreSectionCouleur: boolean
  }
  css: string
}

// Base commune : mise en page A4 à marges définies par @page (impression) ou par le corps (aperçu écran).
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
  section { break-inside: auto; }
  h3, .meta { break-after: avoid; }
`

const CLASSIQUE = `
  body { font-family: Arial, Helvetica, sans-serif; }
  h1 { font-size: 20pt; }
  .titre-poste { font-size: 12pt; margin-top: 2pt; }
  .contact { margin-top: 4pt; color: #333; }
  .photo { order: 2; border-radius: 3pt; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #111; margin: 14pt 0 6pt; padding-bottom: 2pt; }
  h3 { font-size: 10.5pt; margin-top: 8pt; }
  .meta { color: #333; }
`

const MODERNE = `
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; }
  h1 { font-size: 26pt; font-weight: 700; letter-spacing: -.01em; }
  .titre-poste { font-size: 13pt; color: #2563eb; font-weight: 600; margin-top: 2pt; }
  .contact { margin-top: 5pt; color: #4b5563; font-size: 9.5pt; }
  .photo { border-radius: 50%; border: 2pt solid #2563eb; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .12em; color: #2563eb; border-bottom: 2pt solid #2563eb; margin: 16pt 0 7pt; padding-bottom: 3pt; }
  h3 { font-size: 11pt; margin-top: 9pt; color: #111827; }
  .meta { color: #6b7280; font-size: 9.5pt; }
  li::marker { color: #2563eb; }
`

const ELEGANT = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a2a2a; }
  .entete { flex-direction: column; text-align: center; gap: 8pt; padding-bottom: 10pt; border-bottom: 0.75pt solid #c9b99a; }
  .photo { order: -1; border-radius: 50%; width: 30mm; height: 30mm; border: 1pt solid #c9b99a; }
  h1 { font-size: 22pt; font-weight: 400; letter-spacing: .14em; text-transform: uppercase; }
  .titre-poste { font-size: 12pt; font-style: italic; color: #7a5c2e; margin-top: 3pt; }
  .contact { margin-top: 5pt; color: #555; font-size: 9.5pt; }
  h2 { font-size: 11pt; font-weight: 400; font-variant: small-caps; letter-spacing: .16em; text-transform: lowercase; color: #7a5c2e; text-align: center; border-bottom: 0.5pt solid #c9b99a; margin: 16pt 0 7pt; padding-bottom: 3pt; }
  h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { font-style: italic; color: #555; }
`

const BANDEAU = `
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .entete { background: #0f172a; color: #fff; margin: -14mm -16mm 8mm; padding: 14mm 16mm 9mm; }
  .entete h1 { font-size: 25pt; font-weight: 700; }
  .titre-poste { font-size: 12.5pt; color: #38bdf8; font-weight: 600; margin-top: 3pt; }
  .contact { margin-top: 6pt; color: #cbd5e1; font-size: 9.5pt; }
  .photo { order: 2; border-radius: 50%; border: 2pt solid #38bdf8; }
  h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .12em; color: #0f172a; border-left: 3pt solid #38bdf8; padding-left: 7pt; margin: 15pt 0 7pt; }
  h3 { font-size: 11pt; margin-top: 9pt; }
  .meta { color: #64748b; font-size: 9.5pt; }
`

export const MODELES_CV: readonly ModeleCv[] = [
  {
    id: 'classique',
    nom: 'Classique',
    description: 'Sobre et neutre, titres soulignés. Le choix le plus universel.',
    couleur: '#111111',
    docx: { police: 'Calibri', accent: '111111', texte: '111111', entete: 'gauche', titreSectionCouleur: false },
    css: BASE + CLASSIQUE,
  },
  {
    id: 'moderne',
    nom: 'Moderne',
    description: 'Accent bleu, nom en grand, photo ronde. Dynamique sans fioriture.',
    couleur: '#2563eb',
    docx: { police: 'Calibri', accent: '2563EB', texte: '1F2937', entete: 'gauche', titreSectionCouleur: true },
    css: BASE + MODERNE,
  },
  {
    id: 'elegant',
    nom: 'Élégant',
    description: 'Typographie à empattements, en-tête centré, filets fins. Pour les métiers de contact ou de création.',
    couleur: '#7a5c2e',
    docx: { police: 'Georgia', accent: '7A5C2E', texte: '2A2A2A', entete: 'centre', titreSectionCouleur: true },
    css: BASE + ELEGANT,
  },
  {
    id: 'bandeau',
    nom: 'Bandeau',
    description: 'En-tête sur fond sombre avec le nom en blanc, rubriques à liseré. Fort impact visuel.',
    couleur: '#0f172a',
    docx: {
      police: 'Calibri',
      accent: '0F172A',
      texte: '1E293B',
      entete: 'gauche',
      bandeau: '0F172A',
      titreSectionCouleur: true,
    },
    css: BASE + BANDEAU,
  },
]

export const MODELE_PAR_DEFAUT: IdModele = 'classique'

export function trouverModele(id: string | undefined): ModeleCv {
  return MODELES_CV.find((m) => m.id === id) ?? (MODELES_CV[0] as ModeleCv)
}
