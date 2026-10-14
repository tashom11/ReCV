import { cleanJobTitle } from '../job-posting/text'
import type { Profile, Requirements } from '../schemas'
import type { JobAnalysis } from './jobAnalysis'
import { containsWord, experienceText, normalize } from './text'

/**
 * Compétences demandées par l'offre, rapprochées du profil : c'est ce que cherche d'abord le recruteur (ou son ATS).
 * - `evidenced` : déjà présentes dans le profil (compétences, expériences, titre) : on peut les afficher telles quelles ;
 * - `missing` : demandées mais absentes du profil. Le CV ne les ajoute JAMAIS de lui-même : c'est à l'utilisateur
 *   de dire s'il les maîtrise.
 */
export interface JobCoverage {
  evidenced: string[]
  missing: string[]
  requirements: Requirements
}

// Mots d'introduction qui ne désignent pas la compétence elle-même (« Maîtrise de WordPress » → « WordPress »).
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
  // L'intitulé du poste n'est pas une compétence à cocher (avec ou sans « (H/F) »).
  const titles = new Set([normalize(analysis.targetTitle), normalize(cleanJobTitle(analysis.targetTitle))])

  // Ni l'intitulé du poste (ou un morceau : « Chargé de sourcing » pour « Chargé de sourcing et de recrutement »),
  // ni le contexte du contrat : ce ne sont pas des compétences.
  const fullTitle = normalize(cleanJobTitle(analysis.targetTitle))
  const isContext = (t: string) => {
    const n = normalize(t)
    return titles.has(n) || (n.length >= 6 && fullTitle.includes(n)) || CONTRACT_CONTEXT.test(n)
  }

  const seenTerms = new Set<string>()
  // Qualités et outils demandés dans le « profil recherché » d'abord : ce sont les exigences explicites.
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
    // Un mot-clé isolé non attesté (« stratégie », « entretien », « commercial ») est trop vague pour être proposé
    // comme compétence à ajouter ; seuls les outils et qualités explicitement demandés le sont.
    const isolatedWord = term.split(/\s+/).length === 1
    // (Un nom d'outil s'écrit avec une majuscule ou des chiffres : « Ahrefs », « GA4 », « n8n » ne sont pas écartés.)
    const looksLikeCommonNoun = term === term.toLowerCase() && !/\d/.test(term)
    if (isolatedWord && !explicit.has(normalize(term)) && looksLikeCommonNoun) continue
    missing.push(term)
  }
  // Un terme générique inclus dans un terme plus précis de la liste (« audit » dans « audit sémantique ») n'apporte
  // rien : on garde le plus précis.
  const withoutRedundancy = (list: string[]) =>
    list.filter((t) => !list.some((other) => other !== t && containsWord(normalize(other), normalize(t))))
  return {
    evidenced: withoutRedundancy(evidenced).slice(0, MAX_EVIDENCED),
    missing: withoutRedundancy(missing).slice(0, MAX_MISSING),
    requirements: evaluateRequirements(profile, analysis, source),
  }
}

// Mots de contexte (contrat, remplacement…) que le modèle range parfois parmi les « mots-clés ».
const CONTRACT_CONTEXT =
  /^(remplacement|cdi|cdd|interim|intérim|stage|alternance|temps (plein|partiel)|teletravail|télétravail|poste (a|à) pourvoir|poste base|deplacements?|déplacements?|reseaux? commerciaux?|secteur [\p{L} ]+)$/iu

/** Niveau d'études « équivalent Bac + N » d'un texte (« Bac +3 à Bac +5 » → 3, « Master » → 5), sinon null. */
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
    // Domaine de l'expérience demandée : on retire durée et mots d'introduction, il reste « recrutement, sourcing… ».
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

/** Vrai si `terme` est déjà représenté par l'une des compétences listées (inclusion dans un sens ou l'autre). */
export function dejaListee(term: string, skills: string[]): boolean {
  const t = normalize(term)
  return skills.some((c) => {
    const n = normalize(c)
    return n === t || containsWord(n, t) || containsWord(t, n)
  })
}
