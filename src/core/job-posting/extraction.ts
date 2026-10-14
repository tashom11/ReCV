import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { type JobPosting, jobPostingSchema } from '../schemas/jobPosting'
import { extractStructuredJobPosting } from './structuredData'
import { cleanJobPostingText, htmlToText } from './text'

/** Sous ce seuil de caractères, on considère la page comme vide (rendue en JS). */
export const MIN_TEXT_LENGTH = 200

// Le cœur n'a pas la lib DOM : on ne type que ce qu'on utilise.
interface MinimalDocument {
  title: string
  querySelector(selector: string): { getAttribute(name: string): string | null } | null
}

function meta(document: MinimalDocument, selector: string): string | undefined {
  const value = document.querySelector(selector)?.getAttribute('content')?.trim()
  return value || undefined
}

/**
 * Extrait le contenu principal d'une page HTML d'offre d'emploi.
 * Retourne `null` si aucun texte exploitable n'est trouvé.
 */
export function extractJobPostingFromHtml(html: string): JobPosting | null {
  // 1. Données structurées (JobPosting) : intitulé, entreprise, lieu et description propres.
  const structured = extractStructuredJobPosting(html)
  if (structured) {
    const text = cleanJobPostingText(structured.description)
    if (text.length >= MIN_TEXT_LENGTH) {
      return jobPostingSchema.parse({
        jobTitle: structured.title,
        company: structured.company,
        location: structured.location,
        rawText: text,
      })
    }
  }

  // 2. Repli : contenu principal de la page (Readability), en conservant la structure en blocs.
  const { document } = parseHTML(html)

  const metaTitle = meta(document, 'meta[property="og:title"]')
  const company = meta(document, 'meta[property="og:site_name"]')

  const article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0]).parse()
  const rawText = cleanJobPostingText(article?.content ? htmlToText(article.content) : (article?.textContent ?? ''))
  if (rawText.length < MIN_TEXT_LENGTH) return null

  const jobTitle = (article?.title || metaTitle || document.title || '').trim()
  return jobPostingSchema.parse({
    jobTitle: jobTitle || 'Offre sans titre',
    company: company,
    rawText: rawText,
  })
}
