import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { type JobPosting, jobPostingSchema } from '../schemas/jobPosting'
import { extractStructuredJobPosting } from './structuredData'
import { cleanJobPostingText, htmlToText } from './text'

/** Below this number of characters, the page is considered empty (rendered in JS). */
export const MIN_TEXT_LENGTH = 200

// The core has no DOM lib: only what is used is typed.
interface MinimalDocument {
  title: string
  querySelector(selector: string): { getAttribute(name: string): string | null } | null
}

function meta(document: MinimalDocument, selector: string): string | undefined {
  const value = document.querySelector(selector)?.getAttribute('content')?.trim()
  return value || undefined
}

/**
 * Extracts the main content of a job posting HTML page.
 * Returns `null` if no usable text is found.
 */
export function extractJobPostingFromHtml(html: string): JobPosting | null {
  // 1. Structured data (JobPosting): clean title, company, location and description.
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

  // 2. Fallback: main content of the page (Readability), keeping the block structure.
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
