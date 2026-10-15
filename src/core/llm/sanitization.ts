import { type Profile, profileSchema } from '../schemas'
import { filterLinks } from '../schemas/links'
import { isShortSkill, splitSkills } from '../tailoring/skills'

// A model extracting a CV may make up entries (an « experience » made of a « Permis B – Disponibilité immédiate »
// line), or create some from a mere skill. This check in code keeps only what is evidenced in the CV text.

/** Lower case without accents nor ligatures. */
function simplify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Text reduced to its letters and digits: insensitive to spaces, hyphens and line breaks of PDF extraction. */
function compact(text: string): string {
  return simplify(text).replace(/[^\p{L}\p{N}]/gu, '')
}

function significantWords(value: string): string[] {
  return simplify(value).match(/[\p{L}\p{N}]{3,}/gu) ?? []
}

/** True if at least 75 % of the significant words of `value` are in the CV (true if there is nothing to check). */
function isInSource(value: string | undefined, compactSource: string): boolean {
  const words = significantWords(value ?? '')
  if (words.length === 0) return true
  return words.filter((word) => compactSource.includes(word)).length / words.length >= 0.75
}

/** A « position » identical to an education title is a degree wrongly filed among the experiences. */
function isDegree(position: string | undefined, education: Profile['education']): boolean {
  const key = compact(position ?? '')
  return key !== '' && education.some((f) => compact(f.degree ?? '') === key)
}

const empty = (value: string | undefined) => !value || value.trim() === ''

/**
 * Removes from the extracted profile what is not evidenced in `cvText`:
 * - experience with neither company nor dates (ghost position, miscellaneous line taken for an experience), or whose
 *   position or company does not appear in the CV;
 * - education, language, skill, e-mail or phone absent from the CV;
 * - duplicates and empty values.
 */
export function sanitizeProfile(profile: Profile, cvText: string): Profile {
  const source = compact(cvText)
  const sourceDigits = cvText.replace(/\D/g, '')

  // Duplicates (case and accents ignored): the first occurrence is kept.
  const seenKeys = new Set<string>()
  const skills = splitSkills(profile.skills.map((c) => c.trim()))
    // A skill is a short term: sentences describing tasks are not skills.
    .filter((c) => c !== '' && isShortSkill(c) && isInSource(c, source))
    .filter((c) => {
      const key = simplify(c)
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

  const emailEvidenced = !empty(profile.email) && source.includes(compact(profile.email ?? ''))
  const phoneDigits = (profile.phone ?? '').replace(/\D/g, '')
  const phoneEvidenced = phoneDigits.length >= 6 && sourceDigits.includes(phoneDigits)

  return profileSchema.parse({
    ...profile,
    fullName: isInSource(profile.fullName, source) ? profile.fullName : undefined,
    email: emailEvidenced ? profile.email : undefined,
    phone: phoneEvidenced ? profile.phone : undefined,
    headline: isInSource(profile.headline, source) ? profile.headline : undefined,
    experiences: profile.experiences.filter(
      (e) =>
        !empty(e.position) &&
        !isDegree(e.position, profile.education) &&
        (!empty(e.company) || !empty(e.dateRange)) &&
        isInSource(e.position, source) &&
        isInSource(e.company, source),
    ),
    education: profile.education.filter(
      (f) => (!empty(f.degree) || !empty(f.school)) && isInSource(f.degree, source) && isInSource(f.school, source),
    ),
    languages: profile.languages.filter((l) => !empty(l.name) && isInSource(l.name, source)),
    skills: skills,
    links: filterLinks(profile.links),
  })
}

// A CV this long that yields no experience, skill nor education was not read: the model returned empty lists (small
// models do, whatever the question) and an empty profile must not be saved as if it were the CV.
const MIN_TEXT_FOR_EMPTY_CHECK = 300

/** True if nothing but identity could be extracted from a CV that has real content. */
export function isEmptyExtraction(profile: Profile, cvText: string): boolean {
  return (
    profile.experiences.length === 0 &&
    profile.skills.length === 0 &&
    profile.education.length === 0 &&
    cvText.trim().length >= MIN_TEXT_FOR_EMPTY_CHECK
  )
}
