import { z } from 'zod'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, wrapInTag } from '../llm/prompts'
import type { Profile } from '../schemas'
import { boundSummary } from './pipeline'
import { isBulletFaithful } from './rewriting'
import { containsWord, experienceText, normalize } from './text'
import { unsupportedWords } from './vocabulary'

// Bornes minimales : avec une grammaire JSON, un modèle peut sinon répondre par la sortie la plus courte
// valide (« [] » et « "" »). `min` les exclut de la grammaire elle-même.
export const profileSummarySchema = z.object({
  transferableSkills: z.array(z.string().min(2)).min(1),
  summary: z.string().min(15),
})

const SYSTEM_PROMPT = `Tu es un expert en rédaction de CV.
À partir du profil fourni :
1. "transferableSkills" : les compétences transversales du candidat, c'est-à-dire les savoir-être et qualités professionnelles utiles dans n'importe quel métier (rigueur, autonomie, organisation, communication, travail en équipe, adaptabilité, sens du détail, respect des délais, relation client, gestion de projets…). Recopie-les telles qu'elles figurent dans le profil. Exclus toute compétence propre à un métier : outils, logiciels, langages, techniques, diplômes.
2. "summary" : 2 à 3 phrases (400 caractères maximum), écrites à la première personne du singulier (« Je … »), qui présentent le candidat uniquement par ces compétences transversales. Évite les adjectifs qui s'accordent au genre : préfère les noms (« Je fais preuve de rigueur et d'autonomie », « J'ai le sens de l'organisation ») à « je suis rigoureux ». Ne parle jamais de lui à la troisième personne (« il », « le candidat »), pour qu'elle reste valable quelle que soit l'offre visée. Ne cite aucun métier, intitulé de poste, outil, technologie, employeur, secteur d'activité, durée ni chiffre.

${NO_FABRICATION_RULES}`

export const NO_SKILL_MESSAGE =
  'Aucune qualité repérée dans votre CV. Ajoutez-en (rigueur, autonomie, organisation, communication…) dans « Compétences et qualités », puis réessayez.'

// « de rigueur, d'autonomie et de sens du détail » (élision devant une voyelle ou un h)
function listWithDe(elements: string[]): string {
  const withDe = elements.map((e) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(e) ? `d’${e}` : `de ${e}`))
  if (withDe.length <= 1) return withDe.join('')
  return `${withDe.slice(0, -1).join(', ')} et ${withDe[withDe.length - 1]}`
}

// Première personne exigée ; toute désignation à la troisième personne est rejetée.
const FIRST_PERSON_PATTERN = /(?:^|[^\p{L}])(?:je|mon|ma|mes)(?![\p{L}])|(?:^|[^\p{L}])j['’]/iu
const THIRD_PERSON_PATTERN = /(?:^|[^\p{L}])(?:il|elle|le candidat|la candidate|sa|son|ses)(?![\p{L}])/iu

function sourceText(profile: Profile): string {
  return [
    profile.summary ?? '',
    ...profile.skills,
    ...profile.experiences.map(experienceText),
    ...profile.experiences.map((e) => e.dateRange ?? ''),
  ].join('\n')
}

/**
 * Accroche générique fondée sur les seules compétences TRANSVERSALES du profil : elle ne cite aucun savoir-faire
 * de métier, qui pourrait ne pas correspondre aux offres visées. Le modèle propose, le code vérifie :
 * - une compétence n'est retenue que si elle figure mot pour mot dans le profil ;
 * - l'accroche est rejetée si elle cite une compétence de métier, un poste, un employeur ou un chiffre ;
 * - sinon, repli sur une phrase composée uniquement des compétences retenues.
 */
export async function generateProfileSummary(engine: LlmEngine, profile: Profile): Promise<string> {
  const content = {
    skills: profile.skills,
    achievements: profile.experiences.flatMap((e) => [e.description ?? '', ...e.achievements]).filter(Boolean),
    currentSummary: profile.summary,
  }
  const response = await engine.generateObject({
    name: 'profileSummary',
    schema: profileSummarySchema,
    system: SYSTEM_PROMPT,
    user: wrapInTag('profil', JSON.stringify(content, null, 2)),
  })

  const source = sourceText(profile)
  const normalizedSource = normalize(source)
  const selected = [...new Set(response.transferableSkills.map((c) => c.trim()).filter(Boolean))].filter((c) =>
    containsWord(normalizedSource, normalize(c)),
  )
  if (selected.length === 0) throw new Error(NO_SKILL_MESSAGE)

  const normalizedSelected = new Set(selected.map(normalize))
  const forbidden = [
    ...profile.skills.filter((c) => !normalizedSelected.has(normalize(c))),
    ...profile.experiences.flatMap((e) => [e.position, e.company]),
    ...(profile.headline ? [profile.headline] : []),
  ].filter((term) => term.trim().length >= 3)

  const proposed = boundSummary(response.summary)
  const valid =
    proposed !== '' &&
    FIRST_PERSON_PATTERN.test(proposed) &&
    !THIRD_PERSON_PATTERN.test(proposed) &&
    !/\d/.test(proposed) &&
    isBulletFaithful(proposed, source, forbidden) &&
    unsupportedWords(proposed, source).length === 0
  // Apostrophes typographiques, comme dans la phrase de repli.
  if (valid) return proposed.replace(/'/g, '’')
  return `Je fais preuve ${listWithDe(selected.slice(0, 5).map((c) => c.toLowerCase()))}.`
}

export { unsupportedWords }
