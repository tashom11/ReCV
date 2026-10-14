import { z } from 'zod'
import { prepareAnalysisText } from '../job-posting/sections'
import type { LlmEngine } from '../llm/engine'
import { NO_FABRICATION_RULES, sanitizeLine, wrapInTag } from '../llm/prompts'
import type { JobPosting } from '../schemas'
import { containsWord, normalize } from './text'

const MAX_KEYWORDS = 8
const MAX_SKILLS = 8
const MAX_REQUESTED_SOFT_SKILLS = 8

// Sur CPU, le coût d'une étape est surtout la longueur de la RÉPONSE (quelques jetons par seconde) : on borne
// le nombre ET la longueur des termes dans le schéma lui-même (grammaire du modèle embarqué comprise).
// La préparation tronque d'abord une réponse trop longue pour que la validation ne la rejette pas.
function boundedList(maxElements: number, maxCaracteres: number) {
  return z.preprocess(
    (value) =>
      Array.isArray(value)
        ? value.slice(0, maxElements).map((v) => (typeof v === 'string' ? v.slice(0, maxCaracteres) : v))
        : value,
    z.array(z.string().max(maxCaracteres)).max(maxElements),
  )
}

export const jobAnalysisSchema = z.object({
  requiredSkills: boundedList(MAX_SKILLS, 50).default([]),
  softSkills: boundedList(MAX_REQUESTED_SOFT_SKILLS, 40).default([]),
  keywords: boundedList(MAX_KEYWORDS, 40).default([]),
  requiredEducation: z.string().max(80).default(''),
  requiredExperience: z.string().max(100).default(''),
})

export interface JobAnalysis {
  /** Intitulé du poste visé : celui de l'offre (modifiable par l'utilisateur), pas régénéré par le modèle. */
  targetTitle: string
  /** Outils, techniques et savoir-faire demandés. */
  requiredSkills: string[]
  /** Savoir-être et qualités demandés (« orienté résultats », « sens du conseil », « autonomie »…). */
  softSkills: string[]
  keywords: string[]
  /** Prérequis cités par l'offre, tels quels (« Bac +3 à Bac +5 », « 2 ans minimum en recrutement »). */
  requiredEducation: string
  requiredExperience: string
}

const SYSTEM_PROMPT = `Tu es un expert en recrutement et en optimisation de CV pour les logiciels ATS.
Analyse l'offre d'emploi fournie. Elle peut contenir une rubrique « PROFIL RECHERCHÉ » : appuie-toi d'abord sur elle, c'est là que l'employeur liste ce qu'il attend du candidat. Réponds de façon CONCISE (termes courts, pas de phrases) :
- "requiredSkills" : au plus ${MAX_SKILLS} outils, techniques ou savoir-faire demandés (1 à 4 mots chacun : « LinkedIn Recruiter », « CRM candidats », « Approche directe ») ;
- "softSkills" : au plus ${MAX_REQUESTED_SOFT_SKILLS} savoir-être demandés (1 à 4 mots : « Autonomie », « Orienté résultats », « Sens du conseil », « Travail en équipe »), tels que formulés dans le profil recherché ;
- "keywords" : au plus ${MAX_KEYWORDS} autres termes métier qu'un ATS rechercherait ;
- "requiredEducation" : le niveau de formation exigé tel qu'écrit (« Bac +3 à Bac +5 »), sinon vide ;
- "requiredExperience" : l'expérience exigée telle qu'écrite (« 2 ans minimum en recrutement »), sinon vide.
Ne cite JAMAIS l'intitulé du poste, le type de contrat, le lieu ni le contexte (remplacement, CDI, secteur de l'employeur) comme compétence.

${NO_FABRICATION_RULES}`

// Étape 1 : exigences de l'offre.
// Le texte est nettoyé et organisé (profil recherché en premier) avant d'être lu ; titre et termes sont assainis
// (ils sont réinjectés dans les prompts suivants : injection de second ordre).
export async function analyzeJobPosting(engine: LlmEngine, jobPosting: JobPosting): Promise<JobAnalysis> {
  const targetTitle = sanitizeLine(jobPosting.jobTitle, 100)
  const analysis = await engine.generateObject({
    name: 'keywords',
    schema: jobAnalysisSchema,
    system: SYSTEM_PROMPT,
    user: `${wrapInTag('titre', targetTitle)}\n${wrapInTag('offre', prepareAnalysisText(jobPosting.rawText))}`,
  })
  const terms = (values: string[], max: number) =>
    values
      .map((value) => sanitizeLine(value, 50))
      .filter((value) => value.length > 0)
      .slice(0, max)
  return {
    targetTitle,
    requiredSkills: terms(analysis.requiredSkills, MAX_SKILLS),
    softSkills: terms(analysis.softSkills, MAX_REQUESTED_SOFT_SKILLS),
    keywords: terms(analysis.keywords, MAX_KEYWORDS),
    requiredEducation: sanitizeLine(analysis.requiredEducation, 80),
    requiredExperience: sanitizeLine(analysis.requiredExperience, 100),
  }
}

// Garde-fou : ne garde que les mots-clés de l'offre présents dans le texte source.
// Sans ce filtre, un modèle reprend des missions de l'offre (« collaborer avec le design ») absentes du profil.
export function restrictAnalysis(analysis: JobAnalysis, sourceText: string): JobAnalysis {
  const text = normalize(sourceText)
  const present = (terms: string[]) => terms.filter((term) => containsWord(text, normalize(term)))
  return {
    ...analysis,
    keywords: present(analysis.keywords),
    requiredSkills: present(analysis.requiredSkills),
    softSkills: present(analysis.softSkills),
  }
}
