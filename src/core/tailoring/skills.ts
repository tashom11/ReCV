import { normalize } from './text'

// A skill is a short TERM (« Rigueur », « WordPress / CMS », « Sens du détail »), not a sentence describing a task
// (« Installation et maintenance de matériel informatique »). Sentences do not belong in the Skills section of a CV
// (they belong to the achievements of an experience).
const MAX_WORDS = 5
const MAX_CHARACTERS = 50

/** True if `text` looks like a skill: short, without sentence punctuation. */
export function isShortSkill(text: string): boolean {
  const t = text.trim()
  if (t === '' || t.length > MAX_CHARACTERS || /[.;!?]$/.test(t)) return false
  // « & », « / », « - » alone do not count as words.
  const words = t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m))
  return words.length <= MAX_WORDS
}

// Soft skills and professional qualities: useful in any job, so always kept.
// Roots (without accents) compared with the start of the skill's words.
const SOFT_SKILL_ROOTS = [
  'rigueur',
  'rigoureu',
  'autonom',
  'organis',
  'adaptab',
  'adaptatio',
  'polyvalen',
  'reactiv',
  'ponctual',
  'fiabilit',
  'curios',
  'creativ',
  'ecoute',
  'empathi',
  'pedagog',
  'diplomati',
  'relationnel',
  'communicat',
  'equipe',
  'collabor',
  'cooperat',
  'initiativ',
  'motivat',
  'dynamis',
  'perseveran',
  'resilien',
  'sens du',
  'sens des',
  'sens de',
  'esprit',
  'apprentissage',
  'gestion du temps',
  'gestion du stress',
  'gestion des priorit',
  'prise de decision',
  'force de proposition',
  'leadership',
  'negociation',
  'charisme',
  'bienveillan',
  'oriente',
  'assertiv',
  'assertif',
  'aisance',
  'relation',
  'proactiv',
  'engagement',
  'exigence',
  'capacite d',
  'goût',
  'gout',
  'conseil',
  'confiance',
  'ouverture',
  'flexibilit',
  'sociabl',
  'optimis',
  'discretion',
  'integrit',
  'responsabilit',
]

/** True for a transferable quality (rigueur, autonomie, travail en équipe…). */
export function isSoftSkill(skill: string): boolean {
  // Apostrophes (straight or typographic) → space: « d’apprentissage » becomes « d apprentissage ».
  const c = normalize(skill).replace(/['’]/g, ' ')
  return SOFT_SKILL_ROOTS.some((root) => c.startsWith(root) || c.includes(` ${root}`))
}

/** « création digitale » → « Création digitale »; normalised spaces. */
export function formatSkill(term: string): string {
  const t = term.replace(/\s+/g, ' ').trim()
  return t === '' ? t : t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)
}

/** Splits a list of skills into soft skills and tools/techniques, keeping the order. */
export function splitSoftAndHardSkills(skills: string[]): { softSkills: string[]; hardSkills: string[] } {
  return {
    softSkills: skills.filter(isSoftSkill),
    hardSkills: skills.filter((c) => !isSoftSkill(c)),
  }
}

/**
 * « SEO, RGAA, LLM, CRM » → four skills. A list is only split if each of its items is itself a short term (≤ 3
 * words); an enumeration of long sentences stays as it is.
 */
export function splitSkills(skills: string[]): string[] {
  return skills.flatMap((c) => {
    if (!/[,;]/.test(c)) return [c]
    const parts = c
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean)
    const short = parts.length > 1 && parts.every((p) => p.split(/\s+/).length <= 3)
    return short ? parts : [c]
  })
}

/**
 * Deduplication key: a single word is reduced to its root (« Adaptable » = « Adaptabilité »), a phrase is kept whole
 * (« Sens du détail » ≠ « Sens du conseil »).
 */
export function skillKey(skill: string): string {
  const n = normalize(skill).replace(/['’]/g, ' ').trim()
  return /s/.test(n) ? n : n.slice(0, 5)
}

/** Removes duplicates (same key), keeping the first occurrence. */
export function withoutDuplicates(list: string[]): string[] {
  const seenKeys = new Set<string>()
  return list.filter((c) => {
    const key = skillKey(c)
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
}

// Common adjectives and phrases of a « profil recherché » → noun form usable after « je fais preuve de ».
const SOFT_SKILL_NAMES: Record<string, string> = {
  adaptable: 'adaptabilité',
  autonome: 'autonomie',
  rigoureux: 'rigueur',
  rigoureuse: 'rigueur',
  organisé: 'organisation',
  organisée: 'organisation',
  assertif: 'assertivité',
  'assertif(ve)': 'assertivité',
  assertive: 'assertivité',
  curieux: 'curiosité',
  curieuse: 'curiosité',
  polyvalent: 'polyvalence',
  polyvalente: 'polyvalence',
  créatif: 'créativité',
  créative: 'créativité',
  réactif: 'réactivité',
  réactive: 'réactivité',
  ponctuel: 'ponctualité',
  ponctuelle: 'ponctualité',
  reliable: 'fiabilité',
  dynamique: 'dynamisme',
  motivé: 'motivation',
  motivée: 'motivation',
  sociable: 'sens du contact',
  'travail en équipe': 'esprit d’équipe',
  'orienté résultats': 'sens des résultats',
  'orienté résultat': 'sens des résultats',
  'orienté(e) résultats': 'sens des résultats',
}

/**
 * « Je fais preuve d'autonomie, d'adaptabilité et de rigueur. »: fallback sentence made only of evidenced qualities,
 * in the first person, without gender agreement. Empty string if the list is empty.
 */
export function softSkillsSentence(softSkills: string[]): string {
  const elements = softSkills
    .map((q) => q.trim().toLowerCase())
    // « Je fais preuve d'adaptable » n'est pas du français : les adjectifs sont remplacés par leur nom.
    .map((q) => SOFT_SKILL_NAMES[q] ?? q)
    .filter(Boolean)
    .map((q) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(q) ? `d’${q}` : `de ${q}`))
  if (elements.length === 0) return ''
  const list =
    elements.length === 1 ? elements[0] : `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`
  return `Je fais preuve ${list}.`
}
