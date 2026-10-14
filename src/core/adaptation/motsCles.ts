import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { assainirLigne, encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import { preparerTexteAnalyse } from '../offre/sections'
import type { JobPosting } from '../schemas'
import { contientMot, normaliser } from './texte'

const MAX_MOTS_CLES = 8
const MAX_COMPETENCES = 8
const MAX_QUALITES = 8

// Sur CPU, le coût d'une étape est surtout la longueur de la RÉPONSE (quelques jetons par seconde) : on borne
// le nombre ET la longueur des termes dans le schéma lui-même (grammaire du modèle embarqué comprise).
// La préparation tronque d'abord une réponse trop longue pour que la validation ne la rejette pas.
function listeBornee(maxElements: number, maxCaracteres: number) {
  return z.preprocess(
    (valeur) =>
      Array.isArray(valeur)
        ? valeur.slice(0, maxElements).map((v) => (typeof v === 'string' ? v.slice(0, maxCaracteres) : v))
        : valeur,
    z.array(z.string().max(maxCaracteres)).max(maxElements),
  )
}

export const analyseOffreSchema = z.object({
  competencesRequises: listeBornee(MAX_COMPETENCES, 50).default([]),
  qualites: listeBornee(MAX_QUALITES, 40).default([]),
  motsCles: listeBornee(MAX_MOTS_CLES, 40).default([]),
  formationRequise: z.string().max(80).default(''),
  experienceRequise: z.string().max(100).default(''),
})

export interface AnalyseOffre {
  /** Intitulé du poste visé : celui de l'offre (modifiable par l'utilisateur), pas régénéré par le modèle. */
  titreCible: string
  /** Outils, techniques et savoir-faire demandés. */
  competencesRequises: string[]
  /** Savoir-être et qualités demandés (« orienté résultats », « sens du conseil », « autonomie »…). */
  qualites: string[]
  motsCles: string[]
  /** Prérequis cités par l'offre, tels quels (« Bac +3 à Bac +5 », « 2 ans minimum en recrutement »). */
  formationRequise: string
  experienceRequise: string
}

const SYSTEME = `Tu es un expert en recrutement et en optimisation de CV pour les logiciels ATS.
Analyse l'offre d'emploi fournie. Elle peut contenir une rubrique « PROFIL RECHERCHÉ » : appuie-toi d'abord sur elle, c'est là que l'employeur liste ce qu'il attend du candidat. Réponds de façon CONCISE (termes courts, pas de phrases) :
- "competencesRequises" : au plus ${MAX_COMPETENCES} outils, techniques ou savoir-faire demandés (1 à 4 mots chacun : « LinkedIn Recruiter », « CRM candidats », « Approche directe ») ;
- "qualites" : au plus ${MAX_QUALITES} savoir-être demandés (1 à 4 mots : « Autonomie », « Orienté résultats », « Sens du conseil », « Travail en équipe »), tels que formulés dans le profil recherché ;
- "motsCles" : au plus ${MAX_MOTS_CLES} autres termes métier qu'un ATS rechercherait ;
- "formationRequise" : le niveau de formation exigé tel qu'écrit (« Bac +3 à Bac +5 »), sinon vide ;
- "experienceRequise" : l'expérience exigée telle qu'écrite (« 2 ans minimum en recrutement »), sinon vide.
Ne cite JAMAIS l'intitulé du poste, le type de contrat, le lieu ni le contexte (remplacement, CDI, secteur de l'employeur) comme compétence.

${REGLES_ANTI_INVENTION}`

// Étape 1 : exigences de l'offre.
// Le texte est nettoyé et organisé (profil recherché en premier) avant d'être lu ; titre et termes sont assainis
// (ils sont réinjectés dans les prompts suivants : injection de second ordre).
export async function analyserOffre(moteur: MoteurLLM, offre: JobPosting): Promise<AnalyseOffre> {
  const titreCible = assainirLigne(offre.jobTitle, 100)
  const analyse = await moteur.genererObjet({
    nom: 'motsCles',
    schema: analyseOffreSchema,
    systeme: SYSTEME,
    utilisateur: `${encadrer('titre', titreCible)}\n${encadrer('offre', preparerTexteAnalyse(offre.rawText))}`,
  })
  const termes = (valeurs: string[], max: number) =>
    valeurs
      .map((valeur) => assainirLigne(valeur, 50))
      .filter((valeur) => valeur.length > 0)
      .slice(0, max)
  return {
    titreCible,
    competencesRequises: termes(analyse.competencesRequises, MAX_COMPETENCES),
    qualites: termes(analyse.qualites, MAX_QUALITES),
    motsCles: termes(analyse.motsCles, MAX_MOTS_CLES),
    formationRequise: assainirLigne(analyse.formationRequise, 80),
    experienceRequise: assainirLigne(analyse.experienceRequise, 100),
  }
}

// Garde-fou : ne garde que les mots-clés de l'offre présents dans le texte source.
// Sans ce filtre, un modèle reprend des missions de l'offre (« collaborer avec le design ») absentes du profil.
export function restreindreAnalyse(analyse: AnalyseOffre, texteSource: string): AnalyseOffre {
  const texte = normaliser(texteSource)
  const presents = (termes: string[]) => termes.filter((terme) => contientMot(texte, normaliser(terme)))
  return {
    ...analyse,
    motsCles: presents(analyse.motsCles),
    competencesRequises: presents(analyse.competencesRequises),
    qualites: presents(analyse.qualites),
  }
}
