import { z } from 'zod'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, wrapInTag } from '../llm/prompts'
import type { Experience, Profile } from '../schemas'
import type { JobAnalysis } from './jobAnalysis'
import { normalize } from './text'

// Deliberately COMPACT answer (on CPU, the time of a step is that of the answer). For experiences and education: a
// 2-to-4-word field, then a score; for skills: only the list of useful indices (instead of one object per skill,
// ~15 times longer).
const scoreSchema = z.object({
  index: z.number(),
  domain: z.string().max(40).default(''),
  relevance: z.number(),
})

export const relevanceSchema = z.object({
  experiences: z.array(scoreSchema).default([]),
  education: z.array(scoreSchema).default([]),
  usefulSkills: z.array(z.number()).default([]),
})

/** 0 = unrelated to the target position, 1 = transferable / general, 2 = directly related. */
export type RelevanceLevel = 0 | 1 | 2

export interface Relevance {
  experiences: RelevanceLevel[]
  education: RelevanceLevel[]
  skills: RelevanceLevel[]
}

const SYSTEM_PROMPT = `Tu es un expert en recrutement. Tu aides un candidat à présenter honnêtement son parcours pour un poste précis.
Évalue les éléments du profil par rapport au poste visé et à ses exigences.

1. "experiences" et "education" (identifiées par leur "index") : pour chaque élément, un objet {"index", "domain", "relevance"} :
- "domain" : son domaine d'activité en 2 à 4 mots (ex. « développement web », « carrosserie automobile »). Deux expériences du même domaine reçoivent le même libellé ;
- "relevance" : 2 = sert directement une activité ou une exigence de l'offre (même métier, mêmes outils) ; 1 = domaine voisin ou activités en partie communes, ou diplôme dont la spécialité n'est pas précisée ; 0 = domaine sans aucun lien avec l'offre (ex. mécanique ou artisanat pour un poste de communication numérique).
2. "usefulSkills" : la liste des indices des compétences qui servent le poste visé (savoir-faire en lien avec l'offre et qualités professionnelles utiles dans ce poste). Les autres sont omises.

Juge uniquement d'après les données fournies.

${NO_FABRICATION_RULES}`

// Guard: a missing, out-of-range or non-integer score never removes an item (neutral level 1).
export function normalizeLevels(scores: { index: number; relevance: number }[], size: number): RelevanceLevel[] {
  const levels: RelevanceLevel[] = Array.from({ length: size }, () => 1)
  for (const { index, relevance } of scores) {
    if (!Number.isInteger(index) || index < 0 || index >= size || !Number.isFinite(relevance)) continue
    levels[index] = Math.min(2, Math.max(0, Math.round(relevance))) as RelevanceLevel
  }
  return levels
}

/** Useful indices → levels; an empty or fully invalid list removes nothing (neutral level everywhere). */
export function skillLevels(useful: number[], size: number): RelevanceLevel[] {
  const validated = new Set(useful.filter((i) => Number.isInteger(i) && i >= 0 && i < size))
  if (validated.size === 0) return Array.from({ length: size }, () => 1)
  return Array.from({ length: size }, (_, i) => (validated.has(i) ? 1 : 0))
}

// Consistency guard: two experiences of the same field (or with the same job title) cannot be relevant on one side
// and not on the other (Webagence / Agence Pixel: « Développeur web front »).
// Each group takes the highest score.
export function harmonizeExperiences(
  levels: RelevanceLevel[],
  experiences: Pick<Experience, 'position'>[],
  domains: string[] = [],
): RelevanceLevel[] {
  const keys = (i: number) =>
    [
      experiences[i] ? `poste:${normalize(experiences[i].position)}` : '',
      domains[i] ? `domaine:${normalize(domains[i])}` : '',
    ].filter(Boolean)
  // The maximum is spread among items sharing a key, until it is stable.
  const result = [...levels]
  for (let changed = true; changed; ) {
    changed = false
    const best = new Map<string, RelevanceLevel>()
    for (let i = 0; i < result.length; i++) {
      for (const key of keys(i)) best.set(key, Math.max(best.get(key) ?? 0, result[i] ?? 0) as RelevanceLevel)
    }
    for (let i = 0; i < result.length; i++) {
      const max = Math.max(result[i] ?? 0, ...keys(i).map((key) => best.get(key) ?? 0)) as RelevanceLevel
      if (max !== result[i]) {
        result[i] = max
        changed = true
      }
    }
  }
  return result
}

const closestDomainSchema = z.object({ choice: z.number() })

const CLOSEST_DOMAIN_PROMPT = `Tu es un expert en recrutement.
Le candidat n'a aucune expérience dans le métier visé. Parmi les domaines d'activité de son parcours (identifiés par leur "index"), indique celui dont les activités sont les plus proches de celles du poste visé : c'est celui qui sera mis en avant dans son CV.
Réponds avec "choice" : l'indice du domaine le plus proche.

${NO_FABRICATION_RULES}`

// Fallback when no experience was judged relevant: rather than keeping everything (and highlighting again an
// unrelated job), a RELATIVE choice is asked, simpler and more stable than an absolute score.
async function findClosestDomain(
  engine: LlmEngine,
  analysis: JobAnalysis,
  domains: string[],
  experiences: Experience[],
): Promise<string | null> {
  const distinct = [...new Map(domains.filter(Boolean).map((d) => [normalize(d), d])).values()]
  if (distinct.length < 2) return null
  const list = distinct.map((domain, index) => ({
    index,
    domain,
    positions: experiences.filter((_, i) => normalize(domains[i] ?? '') === normalize(domain)).map((e) => e.position),
  }))
  const { choice } = await engine.generateObject({
    name: 'closestDomain',
    schema: closestDomainSchema,
    system: CLOSEST_DOMAIN_PROMPT,
    temperature: 0,
    user: `Poste visé : ${analysis.targetTitle}\n${wrapInTag('profil', JSON.stringify(list, null, 2))}`,
  })
  return Number.isInteger(choice) ? (distinct[choice] ?? null) : null
}

const MAX_ACHIEVEMENTS_SENT = 4
const MAX_ACHIEVEMENT_CHARACTERS = 140

// Step 2: relevance of each profile item to the target position (a single request).
export async function evaluateRelevance(
  engine: LlmEngine,
  profile: Profile,
  analysis: JobAnalysis,
): Promise<Relevance> {
  const { experiences, education, skills } = profile
  if (experiences.length + education.length + skills.length === 0) {
    return { experiences: [], education: [], skills: [] }
  }
  // Lighter input: the judgement relies on the title and the first achievements, not on the whole CV.
  const content = {
    experiences: experiences.map((e, index) => ({
      index,
      position: e.position,
      achievements: e.achievements.slice(0, MAX_ACHIEVEMENTS_SENT).map((r) => r.slice(0, MAX_ACHIEVEMENT_CHARACTERS)),
    })),
    education: education.map((f, index) => ({ index, degree: f.degree })),
    skills: skills.map((name, index) => ({ index, name })),
  }
  const jobRequirements = [...analysis.requiredSkills, ...analysis.keywords]
  const response = await engine.generateObject({
    name: 'relevance',
    schema: relevanceSchema,
    system: SYSTEM_PROMPT,
    temperature: 0,
    user: `Poste visé : ${analysis.targetTitle}\nActivités et exigences de l'offre :\n${jobRequirements.map((e) => `- ${e}`).join('\n')}\n${wrapInTag('profil', JSON.stringify(content))}`,
  })
  const domains = experiences.map((_, i) => response.experiences.find((n) => n.index === i)?.domain ?? '')
  const experienceLevels: RelevanceLevel[] = harmonizeExperiences(
    normalizeLevels(response.experiences, experiences.length),
    experiences,
    domains,
  )
  // No experience judged relevant: the closest field is highlighted rather than keeping everything.
  if (experiences.length >= 2 && Math.max(0, ...experienceLevels) === 0) {
    const closest = await findClosestDomain(engine, analysis, domains, experiences)
    if (closest !== null) {
      domains.forEach((d, i) => {
        if (normalize(d) === normalize(closest)) experienceLevels[i] = 1
      })
    }
  }
  return {
    experiences: experienceLevels,
    education: normalizeLevels(response.education, education.length),
    skills: skillLevels(response.usefulSkills, skills.length),
  }
}

/**
 * Indices to keep: everything except level 0. If nothing survives (job posting unrelated to every item, or
 * inconsistent model answer), everything is kept rather than producing an empty section.
 * `forced`: indices always kept (e.g. a skill quoted word for word in the job posting).
 */
export function keptIndexes(levels: RelevanceLevel[], forced: ReadonlySet<number> = new Set()): number[] {
  const keptIndices = levels.map((_, i) => i).filter((i) => (levels[i] ?? 0) > 0 || forced.has(i))
  return keptIndices.length > 0 ? keptIndices : levels.map((_, i) => i)
}
