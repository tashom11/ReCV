import { parseHTML } from 'linkedom'
import { htmlToText } from './text'

export interface StructuredJobPosting {
  title: string
  company?: string
  location?: string
  description: string
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function findJobPosting(node: unknown): Json | null {
  if (Array.isArray(node)) {
    for (const element of node) {
      const found = findJobPosting(element)
      if (found) return found
    }
    return null
  }
  if (!isObject(node)) return null
  const type = node['@type']
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return node
  return findJobPosting(node['@graph'])
}

function locationClause(jobLocation: unknown): string | undefined {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation]
  const cities = locations
    .map((l) => (isObject(l) && isObject(l.address) ? text(l.address.addressLocality) : undefined))
    .filter((v): v is string => v !== undefined)
  return cities.length > 0 ? [...new Set(cities)].join(', ') : undefined
}

/**
 * Données structurées `JobPosting` (schema.org) de la page, quand le site les publie (Welcome to the Jungle,
 * beaucoup de jobboards : c'est ce que lit Google for Jobs). Plus fiables et plus propres qu'une extraction de texte.
 */
export function extractStructuredJobPosting(html: string): StructuredJobPosting | null {
  const { document } = parseHTML(html) as unknown as {
    document: { querySelectorAll(s: string): ArrayLike<{ textContent: string | null }> }
  }
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    let data: unknown
    try {
      data = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }
    const position = findJobPosting(data)
    const title = text(position?.title)
    const description = text(position?.description)
    if (!position || !title || !description) continue
    const organisation = position.hiringOrganization
    return {
      title,
      company: isObject(organisation) ? text(organisation.name) : text(organisation),
      location: locationClause(position.jobLocation),
      // La description est du HTML (parfois échappé en entités) : on la convertit en texte structuré.
      description: htmlToText(description),
    }
  }
  return null
}
