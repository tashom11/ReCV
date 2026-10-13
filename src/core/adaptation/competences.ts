import { normaliser } from './texte'

// Une compétence est un TERME court (« Rigueur », « WordPress / CMS », « Sens du détail »), pas une phrase décrivant
// une tâche (« Installation et maintenance de matériel informatique »). Les phrases n'ont pas leur place dans la
// section Compétences d'un CV (elles appartiennent aux réalisations d'une expérience).
const MAX_MOTS = 5
const MAX_CARACTERES = 50

/** Vrai si `texte` a la forme d'une compétence : court, sans ponctuation de phrase. */
export function estCompetenceCourte(texte: string): boolean {
  const t = texte.trim()
  if (t === '' || t.length > MAX_CARACTERES || /[.;!?]$/.test(t)) return false
  // « & », « / », « - » seuls ne comptent pas comme des mots.
  const mots = t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m))
  return mots.length <= MAX_MOTS
}

// Savoir-être et qualités professionnelles : utiles dans n'importe quel métier, donc toujours conservés.
// Racines (sans accents) comparées au début des mots de la compétence.
const RACINES_SAVOIR_ETRE = [
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
]

/** Vrai pour une qualité transversale (rigueur, autonomie, travail en équipe…). */
export function estSavoirEtre(competence: string): boolean {
  // Apostrophes (droites ou typographiques) → espace : « d’apprentissage » devient « d apprentissage ».
  const c = normaliser(competence).replace(/['’]/g, ' ')
  return RACINES_SAVOIR_ETRE.some((racine) => c.startsWith(racine) || c.includes(` ${racine}`))
}

/** « création digitale » → « Création digitale » ; espaces normalisés. */
export function formaterCompetence(terme: string): string {
  const t = terme.replace(/\s+/g, ' ').trim()
  return t === '' ? t : t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)
}

/** Sépare une liste de compétences en savoir-être et outils/techniques, en conservant l'ordre. */
export function separerCompetences(competences: string[]): { savoirEtre: string[]; techniques: string[] } {
  return {
    savoirEtre: competences.filter(estSavoirEtre),
    techniques: competences.filter((c) => !estSavoirEtre(c)),
  }
}

/**
 * « SEO, RGAA, LLM, CRM » → quatre compétences. Une liste n'est éclatée que si chacun de ses éléments est lui-même un
 * terme court (≤ 3 mots) ; une enumération de phrases longues reste telle quelle.
 */
export function eclaterCompetences(competences: string[]): string[] {
  return competences.flatMap((c) => {
    if (!/[,;]/.test(c)) return [c]
    const parties = c
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean)
    const courtes = parties.length > 1 && parties.every((p) => p.split(/\s+/).length <= 3)
    return courtes ? parties : [c]
  })
}
