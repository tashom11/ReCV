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
