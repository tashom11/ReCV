import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { assainirLigne, encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import { preparerTexteOffre } from '../offre/texte'
import type { Offre } from '../schemas'
import { contientMot, normaliser } from './texte'

const MAX_MOTS_CLES = 10
const MAX_COMPETENCES = 8

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
  motsCles: listeBornee(MAX_MOTS_CLES, 40).default([]),
  competencesRequises: listeBornee(MAX_COMPETENCES, 50).default([]),
})

export interface AnalyseOffre {
  /** Intitulé du poste visé : celui de l'offre (modifiable par l'utilisateur), pas régénéré par le modèle. */
  titreCible: string
  motsCles: string[]
  competencesRequises: string[]
}

const SYSTEME = `Tu es un expert en recrutement et en optimisation de CV pour les logiciels ATS.
Analyse l'offre d'emploi fournie et extrais, de façon CONCISE :
- "motsCles" : au plus ${MAX_MOTS_CLES} termes (1 à 3 mots chacun) qu'un ATS rechercherait, recopiés de l'offre ;
- "competencesRequises" : au plus ${MAX_COMPETENCES} compétences techniques ou comportementales demandées (1 à 4 mots chacune), recopiées de l'offre.
Pas de phrases : uniquement des termes courts.

${REGLES_ANTI_INVENTION}`

// Étape 1 : mots-clés de l'offre.
// Le texte est nettoyé et plafonné avant d'être lu ; titre et termes sont assainis (ils sont réinjectés dans les
// prompts suivants : injection de second ordre).
export async function analyserOffre(moteur: MoteurLLM, offre: Offre): Promise<AnalyseOffre> {
  const titreCible = assainirLigne(offre.titrePoste, 100)
  const analyse = await moteur.genererObjet({
    nom: 'motsCles',
    schema: analyseOffreSchema,
    systeme: SYSTEME,
    utilisateur: `${encadrer('titre', titreCible)}\n${encadrer('offre', preparerTexteOffre(offre.texteBrut))}`,
  })
  const termes = (valeurs: string[], max: number) =>
    valeurs
      .map((valeur) => assainirLigne(valeur, 50))
      .filter((valeur) => valeur.length > 0)
      .slice(0, max)
  return {
    titreCible,
    motsCles: termes(analyse.motsCles, MAX_MOTS_CLES),
    competencesRequises: termes(analyse.competencesRequises, MAX_COMPETENCES),
  }
}

// Garde-fou : ne garde que les mots-clés de l'offre présents dans le texte source.
// Sans ce filtre, un modèle reprend des missions de l'offre (« collaborer avec le design ») absentes du profil.
export function restreindreAnalyse(analyse: AnalyseOffre, texteSource: string): AnalyseOffre {
  const texte = normaliser(texteSource)
  const presents = (termes: string[]) => termes.filter((terme) => contientMot(texte, normaliser(terme)))
  return {
    titreCible: analyse.titreCible,
    motsCles: presents(analyse.motsCles),
    competencesRequises: presents(analyse.competencesRequises),
  }
}
