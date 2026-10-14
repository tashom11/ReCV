import type { Education, Experience, Language, Profile } from '@core/schemas'

// Pure helpers of the step ① form (no React): testable on their own.

export const toLines = (text: string) => text.split('\n')
const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)

/** Edited lists keep their empty lines while typing; they are removed when saving. */
export function cleanProfile(profile: Profile): Profile {
  return {
    ...profile,
    links: clean(profile.links),
    skills: clean(profile.skills),
    experiences: profile.experiences.map((e) => ({ ...e, achievements: clean(e.achievements) })),
  }
}

/** CEFR levels. The saved value is the one shown on the CV (« Anglais (C1) »). */
export const CEFR_LEVELS = [
  { value: '', label: 'Niveau non précisé' },
  { value: 'Langue maternelle', label: 'Langue maternelle' },
  { value: 'C2', label: 'C2 — Maîtrise' },
  { value: 'C1', label: 'C1 — Autonome, courant' },
  { value: 'B2', label: 'B2 — Intermédiaire supérieur' },
  { value: 'B1', label: 'B1 — Intermédiaire' },
  { value: 'A2', label: 'A2 — Élémentaire' },
  { value: 'A1', label: 'A1 — Débutant' },
]

/** Keeps a level already present (e.g. « Courant » extracted from a CV) even if it is not in the list. */
export function levelOptions(current: string) {
  return current && !CEFR_LEVELS.some((n) => n.value === current)
    ? [...CEFR_LEVELS, { value: current, label: current }]
    : CEFR_LEVELS
}

export const emptyExperience = (): Experience => ({ position: '', company: '', achievements: [] })
export const emptyEducation = (): Education => ({ degree: '', school: '' })
export const emptyLanguage = (): Language => ({ name: '' })

export function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((element, i) => (i === index ? value : element))
}

/** Puts `value` back at `index` (or at the end if the list got shorter): undo of a removal. */
export function insertAt<T>(list: T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)]
}

const joinNonEmpty = (...parts: (string | undefined)[]) => parts.filter((p) => p && p.trim() !== '').join(', ')

export function experiencesSummary(experiences: Experience[]): string {
  const first = experiences[0]
  if (!first) return 'Aucune expérience pour l’instant'
  const rest = experiences.length - 1
  const more = rest > 0 ? ` · et ${rest} autre${rest > 1 ? 's' : ''}` : ''
  return joinNonEmpty(first.position, first.company, first.dateRange) + more
}

export function skillsSummary(skills: string[]): string {
  const items = clean(skills)
  if (items.length === 0) return 'Aucune compétence pour l’instant'
  return items.slice(0, 4).join(', ') + (items.length > 4 ? '…' : '')
}

export function educationSummary(education: Education[]): string {
  const first = education[0]
  return first ? joinNonEmpty(first.degree, first.school, first.dateRange) : 'Aucune formation pour l’instant'
}

export function languagesSummary(languages: Language[]): string {
  if (languages.length === 0) return 'Aucune langue pour l’instant'
  return languages.map((l) => (l.level ? `${l.name} : ${l.level.toLowerCase()}` : l.name)).join(' · ')
}

/** Number of skills actually filled in. */
export const skillCount = (skills: string[]) => clean(skills).length
