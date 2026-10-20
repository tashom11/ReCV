import type { Language, Profile } from '../schemas'
import { isShortSkill } from '../tailoring/skills'
import { normalize } from '../tailoring/text'
import { isSectionHeading, type SectionLines, splitSections } from './cvSections'

// What can be read in the CV without a model: skills, languages and the bullets of the experiences. A small model
// reads these badly (one string for the whole skills list, an empty or partial list of languages, bullets merged into
// the description) and even a good one is not reproducible from one run to the next. Everything returned here is
// copied from the CV text, never generated.

const BULLET = /^\s*[-–—•*▪●·►›]\s*/
// A heading in capitals in the middle of a line: two columns glued together by the extraction (« Canva EXPÉRIENCES »).
const GLUED_HEADING = /\b(?:EXPÉRIENCES?|FORMATIONS?|COMPÉTENCES|LANGUES|PROFIL|QUALITÉS|CONTACT|CERTIFICATIONS)\b/

const linesOf = (sections: SectionLines[], names: SectionLines['section'][]) =>
  sections
    .filter((s) => names.includes(s.section))
    .flatMap((s) => s.lines)
    .filter((line) => !GLUED_HEADING.test(line))

// Splits on the separators outside parentheses: « Excel (tableaux, graphiques), Power BI » → two items.
function splitOutsideParentheses(text: string, separators: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const character of text) {
    if (character === '(') depth++
    if (character === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && separators.test(character)) {
      parts.push(current)
      current = ''
    } else {
      current += character
    }
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

// A list wrapped on two lines (« …, relation client,\npatience ») is one list.
function joinWrappedLines(lines: string[]): string[] {
  const result: string[] = []
  for (const line of lines) {
    const previous = result.at(-1)
    // A skill wrapped in a narrow column (« Community\nmanagement »): a lower-case line after a capital one.
    const continuesSkill =
      previous !== undefined &&
      !BULLET.test(line) &&
      /^\p{Lu}/u.test(previous.replace(BULLET, '')) &&
      /^\p{Ll}/u.test(line) &&
      !/[.:]$/.test(previous)
    if (previous !== undefined && (/[,;]$/.test(previous) || continuesSkill)) {
      result[result.length - 1] = `${previous} ${line}`
    } else result.push(line)
  }
  return result
}

const simplify = (text: string) =>
  normalize(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// Longest skill (see isShortSkill).
const MAX_SKILL_WORDS = 5
const YEAR = /\b(?:19|20)\d{2}\b/

// « Rédaction web • Animation des comptes Facebook, Instagram et LinkedIn »: when the columns are glued, what follows
// a bullet is the sentence of the neighbouring column. A real list item after a bullet is a short term (≤ 5 words), so
// a longer part makes the whole rest of the line foreign: only the text before the first bullet is kept.
function withoutGluedColumn(line: string): string[] {
  const parts = splitOutsideParentheses(line, /[•·]/)
  const glued = parts.slice(1).some((part) => part.split(/\s+/).length > MAX_SKILL_WORDS)
  return glued ? parts.slice(0, 1) : parts
}

/** Skills listed in the skills section(s), one per item (« Logiciels : Sage 100, Cegid » → two skills). */
export function readSkills(cvText: string): string[] {
  const lines = joinWrappedLines(linesOf(splitSections(cvText), ['skills'])).map((l) => l.replace(BULLET, ''))
  const items = lines.flatMap((line) => {
    // « Catégorie : a, b, c »: the category is not a skill.
    const category = /^([^:,]{1,30}):\s*(.+)$/.exec(line)
    const content = category?.[2] && /[,;·|]/.test(category[2]) ? category[2] : line
    return withoutGluedColumn(content).flatMap((part) => splitOutsideParentheses(part, /[,;·|]/))
  })
  const seen = new Set<string>()
  return (
    items
      .map((item) =>
        item
          .replace(BULLET, '')
          .replace(/[.\s]+$/, '')
          .trim(),
      )
      // A year is the date of the neighbouring column (« Community management 2020 – 2024 »), not part of a skill.
      .filter((item) => /[\p{L}\p{N}]/u.test(item) && isShortSkill(item) && !YEAR.test(item))
      .filter((item) => {
        const key = simplify(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  )
}

const KNOWN_LANGUAGES = [
  'anglais',
  'francais',
  'espagnol',
  'allemand',
  'italien',
  'portugais',
  'arabe',
  'chinois',
  'mandarin',
  'cantonais',
  'japonais',
  'coreen',
  'russe',
  'neerlandais',
  'hollandais',
  'polonais',
  'turc',
  'roumain',
  'grec',
  'hindi',
  'suedois',
  'norvegien',
  'danois',
  'finnois',
  'tcheque',
  'hongrois',
  'ukrainien',
  'hebreu',
  'persan',
  'vietnamien',
  'breton',
]

// « Anglais : courant (TOEIC 905) », « Français — Langue maternelle », « Espagnol (A2) », « Allemand ».
function readLanguage(segment: string, strict: boolean): Language | undefined {
  const text = segment.replace(BULLET, '').trim()
  const word = /^[\p{L}-]+/u.exec(text)?.[0]
  if (!word || !KNOWN_LANGUAGES.includes(normalize(word))) return undefined
  const rest = text.slice(word.length).trim()
  // Outside the languages section, a language must be followed by a level (« Anglais : notions »).
  if (strict && !/^[:–—(-]/.test(rest)) return undefined
  const level = rest.startsWith('(') ? /^\(([^)]{1,30})\)/.exec(rest)?.[1] : /^[:–—-]\s*(.{1,40})$/.exec(rest)?.[1]
  const name = word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1).toLocaleLowerCase('fr-FR')
  const cleaned = level?.replace(/[.\s]+$/, '').trim()
  return cleaned ? { name, level: cleaned } : { name }
}

/** Languages of the languages section, and those quoted with a level in the other sections (« Anglais : notions »). */
export function readLanguages(cvText: string): Language[] {
  const sections = splitSections(cvText)
  const found: Language[] = []
  const add = (language: Language | undefined) => {
    if (language && !found.some((l) => normalize(l.name) === normalize(language.name))) found.push(language)
  }
  for (const line of linesOf(sections, ['languages'])) {
    for (const segment of splitOutsideParentheses(line, /[·•|;,]/)) add(readLanguage(segment, false))
  }
  for (const line of linesOf(sections, ['other'])) {
    for (const segment of splitOutsideParentheses(line, /[·•|;.]/)) add(readLanguage(segment, true))
  }
  return found
}

const MARKER = /^\s*[-–—•*▪●·►›]\s+(\S.*)$/

// Index of the line introducing an experience: the position, with the company on the same line or the next two.
function headerIndex(lines: string[], position: string, company: string): number {
  const wanted = simplify(position)
  const employer = simplify(company)
  if (wanted === '') return -1
  return lines.findIndex((line, i) => {
    if (!` ${simplify(line)} `.includes(` ${wanted} `)) return false
    if (employer === '') return true
    return lines.slice(i, i + 3).some((near) => ` ${simplify(near)} `.includes(` ${employer} `))
  })
}

/**
 * Bullets of each experience read in the CV: the lines starting with a bullet under its heading line, up to the next
 * experience or section. Replaces `achievements` only when the model returned fewer (it merges them into the
 * description). Without any bullet in the CV, nothing changes.
 */
export function recoverBullets(profile: Profile, cvText: string): Profile {
  const lines = cvText.split('\n').map((line) => line.trim())
  const sectionStarts = lines.flatMap((line, i) => (isSectionHeading(line) ? [i] : []))
  const headers = profile.experiences.map((e) => headerIndex(lines, e.position, e.company))
  return {
    ...profile,
    experiences: profile.experiences.map((experience, index) => {
      const start = headers[index] ?? -1
      if (start < 0) return experience
      const next = Math.min(
        lines.length,
        ...headers.filter((h) => h > start),
        ...sectionStarts.filter((s) => s > start),
      )
      const bullets: string[] = []
      let afterBlank = false
      for (const line of lines.slice(start + 1, next)) {
        if (line === '') {
          afterBlank = true
          continue
        }
        const marker = MARKER.exec(line)
        if (marker?.[1]) bullets.push(marker[1].trim())
        // A bullet wrapped on the next line starts with a lower-case letter.
        else if (bullets.length > 0 && !afterBlank && /^\p{Ll}/u.test(line)) bullets[bullets.length - 1] += ` ${line}`
        // Any other line after the bullets belongs to something else: an experience the model did not return.
        else if (bullets.length > 0) break
        afterBlank = false
      }
      return bullets.length > experience.achievements.length ? { ...experience, achievements: bullets } : experience
    }),
  }
}

const LOCAL_PART = /[A-Za-z0-9._%+-]/
const DOMAIN = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

// First e-mail address of the text. Starts from each « @ » and reads around it, within bounds: a regular expression
// over the whole text is quadratic on a long run of letters without any « @ » (some PDFs are extracted without spaces).
function findEmail(text: string): string | undefined {
  for (let at = text.indexOf('@'); at > 0; at = text.indexOf('@', at + 1)) {
    let start = at
    while (start > 0 && at - start < 64 && LOCAL_PART.test(text.charAt(start - 1))) start--
    let end = at + 1
    while (end < text.length && end - at < 255 && /[A-Za-z0-9.-]/.test(text.charAt(end))) end++
    const domain = text.slice(at + 1, end).replace(/[.-]+$/, '')
    if (start < at && DOMAIN.test(domain)) return text.slice(start, at + 1 + domain.length)
  }
  return undefined
}

const PHONE = /(?:\+33[\s.]?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)/
// A name: two to four words made of letters, hyphens and apostrophes (« Claire Dubois », « MOREAU Julien »).
const NAME = /^\p{L}[\p{L}'’-]*(?: \p{L}[\p{L}'’-]*){1,3}$/u

/** Name, e-mail and phone found in the first lines of the CV (the name: its first line, when it looks like one). */
export function readContact(cvText: string): { fullName?: string; email?: string; phone?: string } {
  const first = cvText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '')
  const fullName = first && first.length <= 40 && NAME.test(first) && !isSectionHeading(first) ? first : undefined
  const email = findEmail(cvText)
  const phone = PHONE.exec(cvText)?.[0]
  return { ...(fullName ? { fullName } : {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}) }
}

/**
 * The profile completed with what the CV text says: skills, languages and bullets the model left out or merged, and the
 * contact details it did not return.
 */
export function completeProfile(profile: Profile, cvText: string): Profile {
  const contact = readContact(cvText)
  const known = new Set(profile.skills.map(simplify))
  const skills = [...profile.skills, ...readSkills(cvText).filter((s) => !known.has(simplify(s)))]
  const knownLanguages = new Set(profile.languages.map((l) => normalize(l.name)))
  const languages = [
    ...profile.languages,
    ...readLanguages(cvText).filter((l) => !knownLanguages.has(normalize(l.name))),
  ]
  return recoverBullets(
    {
      ...profile,
      fullName: profile.fullName ?? contact.fullName,
      email: profile.email ?? contact.email,
      phone: profile.phone ?? contact.phone,
      skills,
      languages,
    },
    cvText,
  )
}
