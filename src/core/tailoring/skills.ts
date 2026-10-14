import { normalize } from './text'

// Une compétence est un TERME court (« Rigueur », « WordPress / CMS », « Sens du détail »), pas une phrase décrivant
// une tâche (« Installation et maintenance de matériel informatique »). Les phrases n'ont pas leur place dans la
// section Compétences d'un CV (elles appartiennent aux réalisations d'une expérience).
const MAX_WORDS = 5
const MAX_CHARACTERS = 50

/** Vrai si `texte` a la forme d'une compétence : court, sans ponctuation de phrase. */
export function isShortSkill(text: string): boolean {
  const t = text.trim()
  if (t === '' || t.length > MAX_CHARACTERS || /[.;!?]$/.test(t)) return false
  // « & », « / », « - » seuls ne comptent pas comme des mots.
  const words = t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m))
  return words.length <= MAX_WORDS
}

// Savoir-être et qualités professionnelles : utiles dans n'importe quel métier, donc toujours conservés.
// Racines (sans accents) comparées au début des mots de la compétence.
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

/** Vrai pour une qualité transversale (rigueur, autonomie, travail en équipe…). */
export function isSoftSkill(skill: string): boolean {
  // Apostrophes (droites ou typographiques) → espace : « d’apprentissage » devient « d apprentissage ».
  const c = normalize(skill).replace(/['’]/g, ' ')
  return SOFT_SKILL_ROOTS.some((root) => c.startsWith(root) || c.includes(` ${root}`))
}

/** « création digitale » → « Création digitale » ; espaces normalisés. */
export function formatSkill(term: string): string {
  const t = term.replace(/\s+/g, ' ').trim()
  return t === '' ? t : t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)
}

/** Sépare une liste de compétences en savoir-être et outils/techniques, en conservant l'ordre. */
export function splitSoftAndHardSkills(skills: string[]): { softSkills: string[]; hardSkills: string[] } {
  return {
    softSkills: skills.filter(isSoftSkill),
    hardSkills: skills.filter((c) => !isSoftSkill(c)),
  }
}

/**
 * « SEO, RGAA, LLM, CRM » → quatre compétences. Une liste n'est éclatée que si chacun de ses éléments est lui-même un
 * terme court (≤ 3 mots) ; une enumération de phrases longues reste telle quelle.
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
 * Clé de dédoublonnage : un mot seul est ramené à sa racine (« Adaptable » = « Adaptabilité »), une expression est
 * conservée entière (« Sens du détail » ≠ « Sens du conseil »).
 */
export function skillKey(skill: string): string {
  const n = normalize(skill).replace(/['’]/g, ' ').trim()
  return /s/.test(n) ? n : n.slice(0, 5)
}

/** Retire les doublons (même clé), en conservant la première occurrence. */
export function withoutDuplicates(list: string[]): string[] {
  const seenKeys = new Set<string>()
  return list.filter((c) => {
    const key = skillKey(c)
    if (seenKeys.has(key)) return false
    seenKeys.add(key)
    return true
  })
}

// Adjectifs et expressions courants d'un « profil recherché » → forme nominale utilisable après « je fais preuve de ».
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
 * « Je fais preuve d'autonomie, d'adaptabilité et de rigueur. » : phrase de repli composée uniquement de qualités
 * attestées, à la première personne, sans accord de genre. Chaîne vide si la liste est vide.
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
