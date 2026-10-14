import { cleanJobTitle } from '../job-posting/text'
import type { Profile, Requirements } from '../schemas'
import type { JobAnalysis } from './jobAnalysis'
import { containsWord, experienceText, normalize } from './text'

/**
 * Skills requested by the job posting, compared with the profile:
 * it is what the recruiter (or their ATS) looks for first.
 * - `evidenced`: already in the profile (skills, experiences, title): they can be shown as they are;
 * - `missing`: requested but absent from the profile. The CV NEVER adds them by itself: it is up to the user to say
 *   whether they master them.
 */
export interface JobCoverage {
  evidenced: string[]
  missing: string[]
  requirements: Requirements
}

// Introductory words that do not name the skill itself (« Maîtrise de WordPress » → « WordPress »).
const GENERIC_WORDS = new Set([
  'maitrise',
  'maitriser',
  'connaissance',
  'connaissances',
  'experience',
  'experiences',
  'competence',
  'competences',
  'capacite',
  'capacites',
  'bonne',
  'bonnes',
  'excellente',
  'excellentes',
  'solide',
  'solides',
  'pratique',
  'sens',
  'aisance',
  'goût',
  'gout',
  'avec',
  'dans',
  'pour',
  'des',
  'les',
  'une',
  'aux',
  'sur',
])

const MAX_MISSING = 12
const MAX_EVIDENCED = 12

function significantWords(term: string): string[] {
  return (normalize(term).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !GENERIC_WORDS.has(word))
}

const root = (word: string) => word.slice(0, 5)

export function analyzeCoverage(profile: Profile, analysis: JobAnalysis): JobCoverage {
  const source = normalize(
    [
      profile.headline ?? '',
      profile.summary ?? '',
      ...profile.skills,
      ...profile.experiences.map(experienceText),
      ...profile.education.map((f) => f.degree),
    ].join('\n'),
  )
  const sourceRoots = new Set((source.match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(root))
  // The job title is not a skill to tick (with or without « (H/F) »).
  const titles = new Set([normalize(analysis.targetTitle), normalize(cleanJobTitle(analysis.targetTitle))])

  // Neither the job title (or a piece of it: « Chargé de sourcing » for « Chargé de sourcing et de recrutement ») nor
  // the contract context: they are not skills.
  const fullTitle = normalize(cleanJobTitle(analysis.targetTitle))
  const isContext = (t: string) => {
    const n = normalize(t)
    return titles.has(n) || (n.length >= 6 && fullTitle.includes(n)) || CONTRACT_CONTEXT.test(n)
  }

  const seenTerms = new Set<string>()
  // Qualities and tools requested in the « profil recherché » first: they are the explicit requirements.
  const explicit = new Set([...analysis.requiredSkills, ...analysis.softSkills].map((t) => normalize(t.trim())))
  const terms = [...analysis.requiredSkills, ...analysis.softSkills, ...analysis.keywords]
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !isContext(t))
    .filter((t) => {
      const key = normalize(t)
      if (seenTerms.has(key)) return false
      seenTerms.add(key)
      return true
    })

  const evidenced: string[] = []
  const missing: string[] = []
  for (const term of terms) {
    const words = significantWords(term)
    const covered =
      containsWord(source, normalize(term)) ||
      (words.length > 0 && words.filter((m) => sourceRoots.has(root(m))).length / words.length >= 0.75)
    if (covered) {
      evidenced.push(term)
      continue
    }
    // An isolated keyword that is not evidenced (« stratégie », « entretien », « commercial ») is
    // too vague to be offered as a skill to add; only explicitly requested tools and qualities are.
    const isolatedWord = term.split(/\s+/).length === 1
    // (A tool name is written with a capital letter or digits: « Ahrefs », « GA4 », « n8n » are not left out.)
    const looksLikeCommonNoun = term === term.toLowerCase() && !/\d/.test(term)
    if (isolatedWord && !explicit.has(normalize(term)) && looksLikeCommonNoun) continue
    missing.push(term)
  }
  // A generic term included in a more precise term of the list (« audit » in « audit sémantique ») adds nothing: the
  // more precise one is kept.
  const withoutRedundancy = (list: string[]) =>
    list.filter((t) => !list.some((other) => other !== t && containsWord(normalize(other), normalize(t))))
  return {
    evidenced: withoutRedundancy(evidenced).slice(0, MAX_EVIDENCED),
    missing: withoutRedundancy(missing).slice(0, MAX_MISSING),
    requirements: evaluateRequirements(profile, analysis, source),
  }
}

// Context words (contract, replacement…) that the model sometimes files among the « keywords ».
const CONTRACT_CONTEXT =
  /^(remplacement|cdi|cdd|interim|intérim|stage|alternance|temps (plein|partiel)|teletravail|télétravail|poste (a|à) pourvoir|poste base|deplacements?|déplacements?|reseaux? commerciaux?|secteur [\p{L} ]+)$/iu

/** Education level « equivalent to Bac + N » of a text (« Bac +3 à Bac +5 » → 3, « Master » → 5), otherwise null. */
export function educationLevel(text: string): number | null {
  const t = normalize(text)
  const bac = t.match(/bac\s*\+\s*(\d)/)
  if (bac?.[1]) return Number(bac[1])
  if (/\b(master|ingenieur|m2|doctorat)\b/.test(t)) return 5
  if (/\b(licence|bachelor|l3|but)\b/.test(t)) return 3
  if (/\b(bts|dut|deust|l2)\b/.test(t)) return 2
  if (/\bbac\b/.test(t)) return 0
  return null
}

function evaluateRequirements(profile: Profile, analysis: JobAnalysis, source: string): Requirements {
  const result: Requirements = {}

  if (analysis.requiredEducation.trim() !== '') {
    const requiredLevel = educationLevel(analysis.requiredEducation)
    const levels = profile.education.map((f) => educationLevel(f.degree)).filter((n): n is number => n !== null)
    const best = levels.length > 0 ? Math.max(...levels) : null
    const degree = best === null ? undefined : profile.education.find((f) => educationLevel(f.degree) === best)?.degree
    result.education = {
      required: analysis.requiredEducation,
      status: requiredLevel === null || best === null ? 'unknown' : best >= requiredLevel ? 'ok' : 'insufficient',
      profileValue: degree,
    }
  }

  if (analysis.requiredExperience.trim() !== '') {
    // Field of the requested experience: duration and introductory
    // words are removed, « recrutement, sourcing… » remains.
    const domain = significantWords(analysis.requiredExperience).filter(
      (m) => m.length >= 5 && !/^(minimum|annees?|ans?|experience|environnement|idealement|poste|similaire)$/.test(m),
    )
    const sourceRoots = new Set((source.match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(root))
    result.experience = {
      required: analysis.requiredExperience,
      status: domain.some((m) => sourceRoots.has(root(m))) ? 'found' : 'not-found',
    }
  }
  return result
}

/** True if `term` is already represented by one of the listed skills (inclusion either way). */
export function isAlreadyListed(term: string, skills: string[]): boolean {
  const t = normalize(term)
  return skills.some((c) => {
    const n = normalize(c)
    return n === t || containsWord(n, t) || containsWord(t, n)
  })
}
