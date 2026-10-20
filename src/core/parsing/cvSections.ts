import { normalize } from '../tailoring/text'

// Sections of a CV found in code, from its headings. Used to tell the model which lists cannot be empty: with a JSON
// grammar, small models answer « [] » (the shortest valid output) whatever the CV contains.

export interface CvSections {
  experiences: boolean
  education: boolean
  skills: boolean
  languages: boolean
}

// A heading is a short line starting with one of these words (« MON PARCOURS », « Langues : anglais, espagnol »).
const MAX_HEADING_LENGTH = 60
const HEADINGS: Record<keyof CvSections, RegExp> = {
  experiences: /^(?:mon |mes )?(?:experiences?|parcours|emplois?|carriere|postes? occupes?)\b/,
  education: /^(?:ma |mes )?(?:formations?|diplomes?|etudes|education|cursus|scolarite)\b/,
  skills: /^(?:mes )?(?:competences?|savoir[- ]faire|qualites|atouts|aptitudes|outils|ce que je sais faire)\b/,
  languages: /^(?:langues?|langues? parlees?)\b/,
}

// A line with a range of years (« 2019 – 2021 », « 2021-2024 », « depuis 2014 », « 2020 à aujourd'hui »).
const YEAR_RANGE =
  /\b(?:(?:19|20)\d{2}\s*(?:[-–—]|a)\s*(?:(?:19|20)\d{2}|present|aujourd|actuel|ce jour)|depuis\s+(?:\w+\s+)?(?:19|20)\d{2})/
const MIN_DATED_LINES = 2

export type SectionName = keyof CvSections | 'other'

// Sections that end the previous one without being read (« CENTRES D'INTÉRÊT », « CERTIFICATIONS »).
const OTHER_HEADING =
  /^(?:mon |mes |ma )?(?:profil|resume|objectifs?|certifications?|centres? d interets?|interets?|loisirs?|autres?|projets?|references?|contact|informations? (?:personnelles?|diverses?)|divers)\b/
// What may follow a heading word without making the line a sentence (« Expérience professionnelle »).
const HEADING_QUALIFIER = /^(?:professionnelles?|cles?|techniques?|principales?|linguistiques?|et [\p{L} ']{0,30})$/u

export interface SectionLines {
  /** `undefined` before the first heading. */
  section: SectionName | undefined
  lines: string[]
}

// Heading of a line: the keyword alone (or with a qualifier), or followed by a separator that introduces the content
// (« Langues : anglais, espagnol » → rest « anglais, espagnol »). A sentence starting with the word is not a heading.
function headingOf(line: string): { section: SectionName; rest: string } | undefined {
  const simple = normalize(line).replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim()
  if (simple.length === 0 || simple.length > MAX_HEADING_LENGTH) return undefined
  const candidates: [SectionName, RegExp][] = [
    ...(Object.entries(HEADINGS) as [keyof CvSections, RegExp][]),
    ['other', OTHER_HEADING],
  ]
  for (const [section, pattern] of candidates) {
    const match = pattern.exec(simple)
    if (!match) continue
    const rest = simple.slice(match[0].length).trim()
    if (rest === '' || HEADING_QUALIFIER.test(rest)) return { section, rest: '' }
    if (/^[:–—-]/.test(rest)) {
      // The content comes from the original line, after its first separator.
      const separator = line.search(/[:–—]/)
      return { section, rest: separator >= 0 ? line.slice(separator + 1).trim() : '' }
    }
  }
  return undefined
}

/** True if the line is a section heading (alone, or followed by its content). */
export function isSectionHeading(line: string): boolean {
  return headingOf(line) !== undefined
}

/** The non-empty lines of the CV grouped under the heading they follow. */
export function splitSections(cvText: string): SectionLines[] {
  const result: SectionLines[] = [{ section: undefined, lines: [] }]
  for (const raw of cvText.split('\n')) {
    const line = raw.trim()
    if (line === '') continue
    const heading = headingOf(line)
    if (heading) {
      result.push({ section: heading.section, lines: heading.rest ? [heading.rest] : [] })
    } else {
      result.at(-1)?.lines.push(line)
    }
  }
  return result
}

export function detectCvSections(cvText: string): CvSections {
  const lines = cvText
    .split('\n')
    .map((line) => normalize(line).replace(/\s+/g, ' '))
    .filter((line) => line.length > 0)
  const headings = lines.filter((line) => line.length <= MAX_HEADING_LENGTH)
  const has = (pattern: RegExp) => headings.some((line) => pattern.test(line))
  const sections: CvSections = {
    experiences: has(HEADINGS.experiences),
    education: has(HEADINGS.education),
    skills: has(HEADINGS.skills),
    languages: has(HEADINGS.languages),
  }
  // CV without headings: several dated lines are positions held. Not when a training heading exists alone (student
  // CV): the dates are then those of the courses.
  if (!sections.experiences && !sections.education) {
    sections.experiences = lines.filter((line) => YEAR_RANGE.test(line)).length >= MIN_DATED_LINES
  }
  return sections
}
