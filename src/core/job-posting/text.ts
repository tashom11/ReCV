import { parseHTML } from 'linkedom'

// Le cœur n'a pas la lib DOM : on ne type que ce qu'on utilise.
interface DomNode {
  nodeType: number
  nodeName: string
  textContent: string | null
  childNodes: ArrayLike<DomNode>
}

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'UL',
  'OL',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BR',
  'TR',
  'TABLE',
  'BLOCKQUOTE',
  'ASIDE',
  'MAIN',
  'NAV',
  'DL',
  'DT',
  'DD',
  'FIGURE',
  'HR',
])
const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME'])

function normalizeText(text: string): string {
  return (
    text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      // Puce dont le contenu est un bloc (<li><p>…</p></li>) : « - » et texte sur la même ligne.
      .replace(/^- *\n+/gm, '- ')
      .replace(/\n{3,}/g, '\n\n')
      // Puces consécutives : pas de ligne vide entre deux éléments d'une même liste.
      .replace(/^(- [^\n]*)\n\n(?=- )/gm, '$1\n')
      .trim()
  )
}

/**
 * Texte d'un fragment HTML en conservant la structure : retour à la ligne entre blocs, puces « - » pour les
 * listes. `textContent` seul colle les blocs voisins (« contesteAutonomie »), ce qui gêne le modèle.
 */
export function htmlToText(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body><div>${html}</div></body></html>`)
  const chunks: string[] = []

  const visit = (node: DomNode): void => {
    if (node.nodeType === 3) {
      chunks.push(node.textContent ?? '')
      return
    }
    // Document (9) ou fragment (11) : on descend simplement dans les enfants.
    if (node.nodeType === 9 || node.nodeType === 11) {
      for (const child of Array.from(node.childNodes)) visit(child)
      return
    }
    if (node.nodeType !== 1 || IGNORED_TAGS.has(node.nodeName.toUpperCase())) return
    const name = node.nodeName.toUpperCase()
    const block = BLOCK_TAGS.has(name)
    if (block) chunks.push('\n')
    if (name === 'LI') chunks.push('- ')
    for (const child of Array.from(node.childNodes)) visit(child)
    if (block) chunks.push('\n')
  }

  visit(document as unknown as DomNode)
  return normalizeText(chunks.join(''))
}

// --- Nettoyage d'une offre avant de la confier au modèle -------------------------------------------------

// Rubriques sans intérêt pour adapter un CV : déroulé du recrutement, avantages, mentions légales…
const NOISE_HEADINGS = [
  /^(le |notre )?(d[ée]roulement|processus|process|d[ée]roul[ée]) (des |de |du )?(entretiens?|recrutement|s[ée]lection)/i,
  /^[ée]tapes? (du|de) (recrutement|processus)/i,
  /^envie d.en savoir plus/i,
  /^pourquoi\b/i,
  /\bonboarding\b/i,
  /^(le |notre )?process\b/i,
  /^rencontrez\b/i,
  /^voir (plus|moins)$/i,
  /^(les )?avantages\b/i,
  /^(ce que )?nous (vous )?offrons/i,
  /^r[ée]mun[ée]ration/i,
  /^(informations? (compl[ée]mentaires?|pratiques?|l[ée]gales?)|mentions? l[ée]gales?)/i,
  /^(notre )?engagement (en faveur )?(de la |pour la )?(diversit[ée]|inclusion|mixit[ée])/i,
  /^(à|a) propos (de nous|de l.entreprise)$/i,
  /^postuler\b|^partager (cette )?offre|^(offres?|jobs?) similaires?/i,
]
// Lignes isolées à retirer où qu'elles soient.
const NOISE_LINES =
  /(cette annonce est r[ée]dig[ée]e au masculin|toutes nos offres sont ouvertes aux personnes en situation de handicap|(la )?m[êe]me qualit[ée] de traitement|cookies?\b)/i

// Retire les pictogrammes et symboles de tête (« ❄️Pourquoi… », « 🎯 Tes missions »).
const withoutSymbols = (line: string) => line.trim().replace(/^[^\p{L}\p{N}]+/u, '')

// Une ligne « titre de rubrique » : courte, sans ponctuation finale.
export function isHeading(line: string, allowColon = false): boolean {
  const raw = line.trim()
  // Une puce n'est jamais un titre ; une ligne avec parenthèses ou chiffres (« Entretien final (~30 min) »)
  // est un contenu ; un titre tient en quelques mots.
  if (/^[-•*–—]\s/.test(raw) || /[()\d]/.test(raw)) return false
  const l = withoutSymbols(raw)
  const finalPunctuation = allowColon ? /[.!?;,]$/ : /[.!?;,:]$/
  return l.length > 0 && l.length <= 70 && l.split(/\s+/).length <= 8 && !finalPunctuation.test(l) && /^\p{Lu}/u.test(l)
}

/** Retire les rubriques de bruit et les lignes de mentions standard ; conserve missions, profil, compétences. */
export function cleanJobPostingText(text: string): string {
  const output: string[] = []
  let skipping = false
  for (const line of text.split('\n')) {
    const l = withoutSymbols(line)
    if (NOISE_HEADINGS.some((pattern) => pattern.test(l))) {
      skipping = true
      continue
    }
    // Une nouvelle rubrique (qui n'est pas du bruit) met fin au bloc ignoré.
    if (skipping && isHeading(l)) skipping = false
    if (skipping || NOISE_LINES.test(l)) continue
    output.push(line)
  }
  return normalizeText(output.join('\n'))
}

/** Longueur maximale confiée au modèle : le début d'une offre contient l'essentiel (missions, profil). */
export const MAX_ANALYSIS_LENGTH = 4500

/** Texte nettoyé puis tronqué à une limite de ligne : c'est lui que lit le modèle (jamais plus de ~1 200 jetons). */
export function prepareJobPostingText(text: string, max = MAX_ANALYSIS_LENGTH): string {
  const cleaned = cleanJobPostingText(text)
  if (cleaned.length <= max) return cleaned
  const cut = cleaned.slice(0, max)
  const lineEnd = cut.lastIndexOf('\n')
  return (lineEnd > max * 0.6 ? cut.slice(0, lineEnd) : cut).trim()
}

// --- Intitulé d'offre → titre de CV --------------------------------------------------------------------

const GENDER_MARKS = /\s*[([]?\s*\b(?:[hfmwd]\s*[/.-]\s*){1,3}[hfmwdx]\b\s*[)\]]?/giu
const CONTRACT_WORDS =
  /^(?:cdi|cdd|stage|alternance|apprentissage|freelance|ind[ée]pendant|int[ée]rim|temps (?:plein|partiel)|full[ -]?time|part[ -]?time)\b/iu

/**
 * Intitulé d'offre prêt à servir de titre de CV : retire les mentions « (H/F) », le nom de l'entreprise et le type de
 * contrat souvent accolés au titre (« Consultant SEO (H/F) - Eskimoz - CDI » → « Consultant SEO »).
 */
export function cleanJobTitle(title: string, company?: string): string {
  const withoutGender = title.replace(GENDER_MARKS, ' ')
  const parts = withoutGender
    .split(/\s+[-–—|]\s+/u)
    // Espaces normalisés, parenthèses orphelines en bordure retirées (« (e) » au milieu d'un mot est conservé).
    .map((p) =>
      p
        .replace(/\s+/g, ' ')
        .replace(/^[-–—|\s()[\]]+|[-–—|\s([]+$/g, '')
        .trim(),
    )
    .filter((p) => p !== '' && !/^[-–—|]+$/.test(p))
  const companyName = company?.trim().toLowerCase()
  const kept = parts.filter(
    (p, i) => i === 0 || (!CONTRACT_WORDS.test(p) && (companyName === undefined || p.toLowerCase() !== companyName)),
  )
  return kept.join(' - ').trim() || title.trim()
}
