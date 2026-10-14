import { z } from 'zod'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, wrapInTag } from '../llm/prompts'
import type { Experience, Profile } from '../schemas'
import type { JobAnalysis } from './jobAnalysis'
import { normalize } from './text'

// Réponse volontairement COMPACTE (sur CPU, le temps d'une étape est celui de la réponse). Pour les expériences
// et formations : un domaine de 2 à 4 mots, puis une note ; pour les compétences : la seule liste des indices utiles
// (au lieu d'un objet par compétence, ~15 fois plus long).
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

/** 0 = sans rapport avec le poste visé, 1 = transférable / général, 2 = directement lié. */
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

// Garde-fou : une note manquante, hors bornes ou non entière n'élimine jamais un élément (niveau neutre 1).
export function normalizeLevels(scores: { index: number; relevance: number }[], size: number): RelevanceLevel[] {
  const levels: RelevanceLevel[] = Array.from({ length: size }, () => 1)
  for (const { index, relevance } of scores) {
    if (!Number.isInteger(index) || index < 0 || index >= size || !Number.isFinite(relevance)) continue
    levels[index] = Math.min(2, Math.max(0, Math.round(relevance))) as RelevanceLevel
  }
  return levels
}

/** Indices utiles → niveaux ; une liste vide ou entièrement invalide ne retire rien (niveau neutre partout). */
export function skillLevels(useful: number[], size: number): RelevanceLevel[] {
  const validated = new Set(useful.filter((i) => Number.isInteger(i) && i >= 0 && i < size))
  if (validated.size === 0) return Array.from({ length: size }, () => 1)
  return Array.from({ length: size }, (_, i) => (validated.has(i) ? 1 : 0))
}

// Garde-fou de cohérence : deux expériences du même domaine (ou au même intitulé de poste) ne peuvent pas être
// pertinentes d'un côté et pas de l'autre (Webagence / Agence Pixel : « Développeur web front »).
// Chaque groupe prend la note la plus haute.
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
  // On propage le maximum entre éléments partageant une clé, jusqu'à stabilité.
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

// Repli quand aucune expérience n'a été jugée pertinente : plutôt que de tout garder (et de remettre en avant
// un métier sans aucun rapport), on demande un choix RELATIF, plus simple et plus stable qu'une note absolue.
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

// Étape 2 : pertinence de chaque élément du profil par rapport au poste visé (une seule requête).
export async function evaluateRelevance(
  engine: LlmEngine,
  profile: Profile,
  analysis: JobAnalysis,
): Promise<Relevance> {
  const { experiences, education, skills } = profile
  if (experiences.length + education.length + skills.length === 0) {
    return { experiences: [], education: [], skills: [] }
  }
  // Entrée allégée : le jugement s'appuie sur l'intitulé et les premières réalisations, pas sur tout le CV.
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
  // Aucune expérience jugée pertinente : on met en avant le domaine le plus proche plutôt que tout garder.
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
 * Indices à conserver : tout sauf le niveau 0. Si rien ne survit (offre sans rapport avec aucun
 * élément, ou réponse du modèle incohérente), on garde tout plutôt que de produire une section vide.
 * `imposes` : indices toujours conservés (ex. compétence citée mot pour mot dans l'offre).
 */
export function keptIndexes(levels: RelevanceLevel[], forced: ReadonlySet<number> = new Set()): number[] {
  const keptIndices = levels.map((_, i) => i).filter((i) => (levels[i] ?? 0) > 0 || forced.has(i))
  return keptIndices.length > 0 ? keptIndices : levels.map((_, i) => i)
}
