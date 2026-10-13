import { parseHTML } from 'linkedom'

// Le cœur n'a pas la lib DOM : on ne type que ce qu'on utilise.
interface Noeud {
  nodeType: number
  nodeName: string
  textContent: string | null
  childNodes: ArrayLike<Noeud>
}

const BLOCS = new Set([
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
const IGNORES = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME'])

function normaliserTexte(texte: string): string {
  return (
    texte
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
export function htmlVersTexte(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body><div>${html}</div></body></html>`)
  const morceaux: string[] = []

  const visiter = (noeud: Noeud): void => {
    if (noeud.nodeType === 3) {
      morceaux.push(noeud.textContent ?? '')
      return
    }
    // Document (9) ou fragment (11) : on descend simplement dans les enfants.
    if (noeud.nodeType === 9 || noeud.nodeType === 11) {
      for (const enfant of Array.from(noeud.childNodes)) visiter(enfant)
      return
    }
    if (noeud.nodeType !== 1 || IGNORES.has(noeud.nodeName.toUpperCase())) return
    const nom = noeud.nodeName.toUpperCase()
    const bloc = BLOCS.has(nom)
    if (bloc) morceaux.push('\n')
    if (nom === 'LI') morceaux.push('- ')
    for (const enfant of Array.from(noeud.childNodes)) visiter(enfant)
    if (bloc) morceaux.push('\n')
  }

  visiter(document as unknown as Noeud)
  return normaliserTexte(morceaux.join(''))
}

// --- Nettoyage d'une offre avant de la confier au modèle -------------------------------------------------

// Rubriques sans intérêt pour adapter un CV : déroulé du recrutement, avantages, mentions légales…
const TITRES_BRUIT = [
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
const LIGNES_BRUIT =
  /(cette annonce est r[ée]dig[ée]e au masculin|toutes nos offres sont ouvertes aux personnes en situation de handicap|(la )?m[êe]me qualit[ée] de traitement|cookies?\b)/i

// Retire les pictogrammes et symboles de tête (« ❄️Pourquoi… », « 🎯 Tes missions »).
const sansSymboles = (ligne: string) => ligne.trim().replace(/^[^\p{L}\p{N}]+/u, '')

// Une ligne « titre de rubrique » : courte, sans ponctuation finale.
export function estTitre(ligne: string, autoriserDeuxPoints = false): boolean {
  const brute = ligne.trim()
  // Une puce n'est jamais un titre ; une ligne avec parenthèses ou chiffres (« Entretien final (~30 min) »)
  // est un contenu ; un titre tient en quelques mots.
  if (/^[-•*–—]\s/.test(brute) || /[()\d]/.test(brute)) return false
  const l = sansSymboles(brute)
  const ponctuationFinale = autoriserDeuxPoints ? /[.!?;,]$/ : /[.!?;,:]$/
  return (
    l.length > 0 && l.length <= 70 && l.split(/\s+/).length <= 8 && !ponctuationFinale.test(l) && /^\p{Lu}/u.test(l)
  )
}

/** Retire les rubriques de bruit et les lignes de mentions standard ; conserve missions, profil, compétences. */
export function nettoyerTexteOffre(texte: string): string {
  const sortie: string[] = []
  let ignorer = false
  for (const ligne of texte.split('\n')) {
    const l = sansSymboles(ligne)
    if (TITRES_BRUIT.some((motif) => motif.test(l))) {
      ignorer = true
      continue
    }
    // Une nouvelle rubrique (qui n'est pas du bruit) met fin au bloc ignoré.
    if (ignorer && estTitre(l)) ignorer = false
    if (ignorer || LIGNES_BRUIT.test(l)) continue
    sortie.push(ligne)
  }
  return normaliserTexte(sortie.join('\n'))
}

/** Longueur maximale confiée au modèle : le début d'une offre contient l'essentiel (missions, profil). */
export const LONGUEUR_MAX_ANALYSE = 4500

/** Texte nettoyé puis tronqué à une limite de ligne : c'est lui que lit le modèle (jamais plus de ~1 200 jetons). */
export function preparerTexteOffre(texte: string, max = LONGUEUR_MAX_ANALYSE): string {
  const propre = nettoyerTexteOffre(texte)
  if (propre.length <= max) return propre
  const coupe = propre.slice(0, max)
  const finLigne = coupe.lastIndexOf('\n')
  return (finLigne > max * 0.6 ? coupe.slice(0, finLigne) : coupe).trim()
}

// --- Intitulé d'offre → titre de CV --------------------------------------------------------------------

const MARQUES_GENRE = /\s*[([]?\s*\b(?:[hfmwd]\s*[/.-]\s*){1,3}[hfmwdx]\b\s*[)\]]?/giu
const MOTS_CONTRAT =
  /^(?:cdi|cdd|stage|alternance|apprentissage|freelance|ind[ée]pendant|int[ée]rim|temps (?:plein|partiel)|full[ -]?time|part[ -]?time)\b/iu

/**
 * Intitulé d'offre prêt à servir de titre de CV : retire les mentions « (H/F) », le nom de l'entreprise et le type de
 * contrat souvent accolés au titre (« Consultant SEO (H/F) - Eskimoz - CDI » → « Consultant SEO »).
 */
export function nettoyerTitreOffre(titre: string, entreprise?: string): string {
  const sansGenre = titre.replace(MARQUES_GENRE, ' ')
  const parties = sansGenre
    .split(/\s+[-–—|]\s+/u)
    // Espaces normalisés, parenthèses orphelines en bordure retirées (« (e) » au milieu d'un mot est conservé).
    .map((p) =>
      p
        .replace(/\s+/g, ' ')
        .replace(/^[-–—|\s()[\]]+|[-–—|\s([]+$/g, '')
        .trim(),
    )
    .filter((p) => p !== '' && !/^[-–—|]+$/.test(p))
  const societe = entreprise?.trim().toLowerCase()
  const gardees = parties.filter(
    (p, i) => i === 0 || (!MOTS_CONTRAT.test(p) && (societe === undefined || p.toLowerCase() !== societe)),
  )
  return gardees.join(' - ').trim() || titre.trim()
}
