import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Offre } from '../schemas'
import { contientMot, normaliser } from './texte'

export const analyseOffreSchema = z.object({
  titreCible: z.string(),
  motsCles: z.array(z.string()).default([]),
  competencesRequises: z.array(z.string()).default([]),
})
export type AnalyseOffre = z.infer<typeof analyseOffreSchema>

const SYSTEME = `Tu es un expert en recrutement et en optimisation de CV pour les logiciels ATS.
Analyse l'offre d'emploi fournie et extrais :
- "titreCible" : l'intitulé du poste visé ;
- "motsCles" : 10 à 20 termes ou expressions qu'un ATS rechercherait, recopiés tels qu'ils apparaissent dans l'offre ;
- "competencesRequises" : les compétences techniques et comportementales demandées, recopiées de l'offre.

${REGLES_ANTI_INVENTION}`

// Étape 1 : mots-clés de l'offre.
export function analyserOffre(moteur: MoteurLLM, offre: Offre): Promise<AnalyseOffre> {
  return moteur.genererObjet({
    nom: 'motsCles',
    schema: analyseOffreSchema,
    systeme: SYSTEME,
    utilisateur: `Intitulé annoncé : ${offre.titrePoste}\n${encadrer('offre', offre.texteBrut)}`,
  })
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
