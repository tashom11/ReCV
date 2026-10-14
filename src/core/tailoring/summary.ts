import { z } from 'zod'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, wrapInTag } from '../llm/prompts'
import type { JobAnalysis } from './jobAnalysis'

// Le titre du CV n'est pas rédigé par le modèle : il reprend l'intitulé de l'offre, nettoyé en code (voir pipeline.ts).
export const summarySchema = z.object({ summary: z.string() })
export type Summary = z.infer<typeof summarySchema>

const SYSTEM_PROMPT = `Tu es un expert en rédaction de CV optimisés pour les ATS.
Rédige l'"summary" du profil fourni : 2 à 3 phrases (400 caractères maximum), à la première personne du singulier (« Je … »).
- Évite les adjectifs qui s'accordent au genre : préfère « je fais preuve de rigueur » à « je suis rigoureux ».
- Mets en avant EN PRIORITÉ les qualités et compétences transversales du profil qui correspondent aux « qualités demandées par l'offre » fournies, puis les outils et savoir-faire demandés, puis ce que les expériences apportent à ces exigences.
- N'utilise QUE les données fournies : ne décris aucune tâche, aucun outil ni aucun secteur qui n'y figure pas. S'il n'y a aucune réalisation, parle uniquement des qualités.
- N'affirme jamais exercer ou avoir exercé le poste visé. N'indique aucune durée d'expérience ni aucun chiffre qui ne figure pas tel quel dans les données.
- Les mots-clés de l'offre servent uniquement à choisir quoi mettre en avant : ne reprends jamais une mission, une qualité ou une responsabilité de l'offre qui n'apparaît pas dans le profil.

${NO_FABRICATION_RULES}`

// Étape 4 : accroche, rédigée à partir des seuls éléments conservés.
/** Ce que le modèle a le droit de mobiliser : uniquement ce qui répond à l'offre (le reste du profil est omis). */
export interface SummaryInput {
  /** Savoir-être du profil et compétences demandées par l'offre que le profil atteste. */
  skills: string[]
  /** Réalisations qui recoupent des termes de l'offre : jamais les autres tâches du profil. */
  achievements: string[]
}

export function writeSummary(engine: LlmEngine, content: SummaryInput, analysis: JobAnalysis): Promise<Summary> {
  return engine.generateObject({
    name: 'summary',
    schema: summarySchema,
    system: SYSTEM_PROMPT,
    user: `Poste visé : ${analysis.targetTitle}\nQualités demandées par l'offre : ${analysis.softSkills.join(', ') || '—'}\nOutils et savoir-faire demandés : ${analysis.requiredSkills.join(', ') || '—'}\n${wrapInTag('profil', JSON.stringify(content, null, 2))}`,
  })
}
