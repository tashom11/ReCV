// Scores an extracted profile against the expected result of a benchmark case.
// Comparisons ignore case, accents, punctuation and dash styles: the benchmark measures what the model READ, not how
// it spelled it.
import type { Profile } from '../../src/core/schemas'
import { normalize } from '../../src/core/tailoring/text'

/** What a benchmark case must yield: the facts a user expects to find in their profile. */
export interface ExpectedProfile {
  fullName?: string
  email?: string
  phone?: string
  experiences: { position: string; company: string; dateRange?: string; bullets: number }[]
  education: { degree: string; school?: string }[]
  skills: string[]
  languages: string[]
}

/** Recall: share of the expected items found. Precision: share of the extracted items that were expected. */
export interface ListScore {
  expected: number
  extracted: number
  found: number
  recall: number
  precision: number
}

export interface CaseScore {
  experiences: ListScore
  /** Among the experiences found, share with the right dates; `null` when no experience was found. */
  dates: number | null
  /** Among the experiences found, share of the expected bullets kept (achievements and description); `null` likewise. */
  bullets: number | null
  education: ListScore
  skills: ListScore
  languages: ListScore
  /** Share of the expected contact fields (name, e-mail, phone) correctly extracted. */
  contact: number
  /** Overall score from 0 to 1: mean of the F1 of each list and of the contact share. */
  overall: number
}

export function key(text: string | undefined): string {
  return normalize(text ?? '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// Same item: equal keys, or one contains the other (« Société Alpha » / « Alpha »).
export function isSimilar(a: string | undefined, b: string | undefined): boolean {
  const ka = key(a)
  const kb = key(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  const [short, long] = ka.length < kb.length ? [ka, kb] : [kb, ka]
  return short.length >= 3 && ` ${long} `.includes(` ${short} `)
}

// Each extracted item is matched at most once: two copies of the same experience do not count twice.
function match<E, X>(expected: E[], extracted: X[], same: (e: E, x: X) => boolean): [E, X][] {
  const used = new Set<number>()
  const pairs: [E, X][] = []
  for (const e of expected) {
    const index = extracted.findIndex((x, i) => !used.has(i) && same(e, x))
    if (index < 0) continue
    used.add(index)
    pairs.push([e, extracted[index] as X])
  }
  return pairs
}

function listScore(expected: number, extracted: number, found: number): ListScore {
  return {
    expected,
    extracted,
    found,
    // Nothing expected and nothing extracted: perfect.
    recall: expected === 0 ? 1 : found / expected,
    precision: extracted === 0 ? (expected === 0 ? 1 : 0) : found / extracted,
  }
}

const f1 = ({ recall, precision }: ListScore) =>
  recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision)
const mean = (values: number[]) => (values.length === 0 ? 1 : values.reduce((a, b) => a + b, 0) / values.length)
// Share measured among the experiences found: nothing found, nothing to measure.
const meanOrNull = (values: number[]) => (values.length === 0 ? null : mean(values))

export function scoreProfile(profile: Profile, expected: ExpectedProfile): CaseScore {
  const experiences = match(
    expected.experiences,
    profile.experiences,
    (e, x) => isSimilar(e.position, x.position) && isSimilar(e.company, x.company),
  )
  const dates = meanOrNull(
    experiences.filter(([e]) => e.dateRange).map(([e, x]) => (key(e.dateRange) === key(x.dateRange) ? 1 : 0)),
  )
  const bullets = meanOrNull(
    experiences
      .filter(([e]) => e.bullets > 0)
      .map(([e, x]) => Math.min(1, (x.achievements.length + (x.description ? 1 : 0)) / e.bullets)),
  )
  const education = match(
    expected.education,
    profile.education,
    (e, x) => isSimilar(e.degree, x.degree) && (!e.school || isSimilar(e.school, x.school)),
  )
  const skills = match(expected.skills, profile.skills, isSimilar)
  const languages = match(
    expected.languages,
    profile.languages.map((l) => l.name),
    isSimilar,
  )

  const digits = (text: string | undefined) => (text ?? '').replace(/\D/g, '')
  const contactChecks = [
    expected.fullName === undefined ? undefined : key(expected.fullName) === key(profile.fullName),
    expected.email === undefined ? undefined : key(expected.email) === key(profile.email),
    expected.phone === undefined ? undefined : digits(expected.phone) === digits(profile.phone),
  ].filter((check) => check !== undefined)
  const contact = mean(contactChecks.map((ok) => (ok ? 1 : 0)))

  const lists = {
    experiences: listScore(expected.experiences.length, profile.experiences.length, experiences.length),
    education: listScore(expected.education.length, profile.education.length, education.length),
    skills: listScore(expected.skills.length, profile.skills.length, skills.length),
    languages: listScore(expected.languages.length, profile.languages.length, languages.length),
  }
  return {
    ...lists,
    dates,
    bullets,
    contact,
    overall: mean([...Object.values(lists).map(f1), contact]),
  }
}
