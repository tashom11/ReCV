import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { type Offre, offreSchema } from '../schemas/offre'

/** Sous ce seuil de caractères, on considère la page comme vide (rendue en JS). */
export const LONGUEUR_MIN_TEXTE = 200

// Le cœur n'a pas la lib DOM : on ne type que ce qu'on utilise.
interface DocumentMinimal {
  title: string
  querySelector(selecteur: string): { getAttribute(nom: string): string | null } | null
}

function meta(document: DocumentMinimal, selecteur: string): string | undefined {
  const valeur = document.querySelector(selecteur)?.getAttribute('content')?.trim()
  return valeur || undefined
}

function normaliserTexte(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extrait le contenu principal d'une page HTML d'offre d'emploi.
 * Retourne `null` si aucun texte exploitable n'est trouvé.
 */
export function extraireOffreDepuisHtml(html: string): Offre | null {
  const { document } = parseHTML(html)

  const titreMeta = meta(document, 'meta[property="og:title"]')
  const entreprise = meta(document, 'meta[property="og:site_name"]')

  const article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0]).parse()
  const texteBrut = normaliserTexte(article?.textContent ?? '')
  if (texteBrut.length < LONGUEUR_MIN_TEXTE) return null

  const titrePoste = (article?.title || titreMeta || document.title || '').trim()
  return offreSchema.parse({
    titrePoste: titrePoste || 'Offre sans titre',
    entreprise,
    texteBrut,
  })
}
