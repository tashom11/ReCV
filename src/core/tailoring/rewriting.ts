import { z } from 'zod'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, wrapInTag } from '../llm/prompts'
import type { Experience } from '../schemas'
import { type JobAnalysis, restrictAnalysis } from './jobAnalysis'
import { containsWord, experienceText, normalize, numbers } from './text'

export const rewritingSchema = z.object({ bullets: z.array(z.string()).default([]) })

const system = (maxPoints: number) => `Tu es un expert en rédaction de CV optimisés pour les ATS.
Réécris l'expérience fournie en au plus ${maxPoints} puces ("bullets") :
- commence chaque puce par un verbe d'action, une idée par puce, phrases courtes ;
- mets en avant ce qui correspond aux mots-clés de l'offre, en reprenant leur formulation UNIQUEMENT s'ils décrivent fidèlement ce que contient déjà l'expérience ;
- ne mentionne jamais un outil, une technologie ou une compétence absente de l'expérience, même si l'offre le demande ;
- conserve les chiffres exacts, n'en crée aucun.

${NO_FABRICATION_RULES}`

// A small model may leave JSON punctuation in a bullet (« ,Collaboration… », « ], »).
// These leftovers are removed at both ends; a bullet without a usable word is dropped (empty string).
export function cleanBullet(bullet: string): string {
  const cleaned = bullet
    .replace(/^[\s,;:.\][{}()"'`•*–—-]+/u, '')
    .replace(/[\s,;:\][{}("'`]+$/u, '')
    .trim()
  return /\p{L}{3,}/u.test(cleaned) ? cleaned : ''
}

// Original bullets of the profile, used if the LLM returns nothing usable.
export function originalBullets(experience: Experience): string[] {
  if (experience.achievements.length > 0) return experience.achievements
  return experience.description ? [experience.description] : []
}

// Guard: rejects a bullet quoting a job posting term absent from the
// experience, or a number absent from the source (made-up figure).
export function isBulletFaithful(bullet: string, sourceText: string, absentTerms: string[]): boolean {
  const text = normalize(bullet)
  if (absentTerms.some((term) => containsWord(text, normalize(term)))) return false
  const sourceNumbers = new Set(numbers(sourceText))
  return numbers(bullet).every((count) => sourceNumbers.has(count))
}

// Word roots (first 5 letters, without accents): « ponçage »/« poncer » meet.
function wordRoots(text: string): string[] {
  return (normalize(text).match(/[\p{L}\p{N}]{4,}/gu) ?? []).map((word) => word.slice(0, 5))
}

/**
 * Bullet selection WITHOUT the model: the `max` original bullets closest to the job posting terms are kept (matching
 * word roots), in their original order. Instant, and nothing can be made up.
 * This is the default mode; rewording by the model (`rewriteExperience`) is optional.
 */
export function selectBullets(experience: Experience, terms: string[], max: number): string[] {
  const original = originalBullets(experience)
  if (original.length <= max) return original
  const jobRoots = new Set(terms.flatMap(wordRoots))
  const score = (bullet: string) => new Set(wordRoots(bullet).filter((r) => jobRoots.has(r))).size
  const selectedIndexes = new Set(
    original
      .map((bullet, rank) => ({ bullet, rank, score: score(bullet) }))
      .sort((a, b) => b.score - a.score || a.rank - b.rank)
      .slice(0, max)
      .map((e) => e.rank),
  )
  return original.filter((_, rank) => selectedIndexes.has(rank))
}

/** Original bullets matching at least one job posting term (closest first), at most `max`. */
export function bulletsCloseToJob(experience: Experience, terms: string[], max: number): string[] {
  const jobRoots = new Set(terms.flatMap(wordRoots))
  return originalBullets(experience)
    .map((bullet, rank) => ({ bullet, rank, score: new Set(wordRoots(bullet).filter((r) => jobRoots.has(r))).size }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .slice(0, max)
    .map((e) => e.bullet)
}

// Step 3: rewriting ONE experience (called experience by experience).
export async function rewriteExperience(
  engine: LlmEngine,
  experience: Experience,
  fullAnalysis: JobAnalysis,
  maxPoints: number,
): Promise<string[]> {
  if (originalBullets(experience).length === 0) return []
  const source = experienceText(experience)
  // The LLM only receives the keywords the experience already contains.
  const analysis = restrictAnalysis(fullAnalysis, source)
  const absentTerms = [...fullAnalysis.keywords, ...fullAnalysis.requiredSkills].filter(
    (term) => !analysis.keywords.includes(term) && !analysis.requiredSkills.includes(term),
  )
  const content = {
    position: experience.position,
    company: experience.company,
    description: experience.description,
    achievements: experience.achievements,
  }
  const { bullets } = await engine.generateObject({
    name: 'rewriting',
    schema: rewritingSchema,
    system: system(maxPoints),
    user: `Poste visé : ${analysis.targetTitle}\nMots-clés de l'offre : ${analysis.keywords.join(', ')}\n${wrapInTag('experience', JSON.stringify(content, null, 2))}`,
  })
  const cleaned = bullets
    .map(cleanBullet)
    .filter((bullet) => bullet.length > 0 && isBulletFaithful(bullet, source, absentTerms))
  return cleaned.length > 0 ? cleaned.slice(0, maxPoints) : originalBullets(experience)
}
