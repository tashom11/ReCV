import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Experience } from '../schemas'
import type { AnalyseOffre } from './motsCles'

export const classementSchema = z.object({ ordre: z.array(z.number()) })

const SYSTEME = `Tu es un expert en recrutement.
Classe les expériences fournies (identifiées par leur "indice") de la plus pertinente à la moins pertinente pour l'offre décrite par ses mots-clés.
Réponds avec "ordre" : la liste de TOUS les indices, chacun une seule fois.

${REGLES_ANTI_INVENTION}`

// Garde-fou : quelle que soit la réponse du LLM, renvoie une permutation de 0..taille-1
// (indices invalides ou dupliqués ignorés, indices oubliés ajoutés à la fin).
export function completerPermutation(ordre: number[], taille: number): number[] {
  const vus = new Set<number>()
  for (const indice of ordre) {
    if (Number.isInteger(indice) && indice >= 0 && indice < taille) vus.add(indice)
  }
  for (let indice = 0; indice < taille; indice++) vus.add(indice)
  return [...vus]
}

// Étape 2 : classement des expériences par pertinence.
export async function classerExperiences(
  moteur: MoteurLLM,
  experiences: Experience[],
  analyse: AnalyseOffre,
): Promise<number[]> {
  if (experiences.length <= 1) return experiences.map((_, indice) => indice)
  const resume = experiences.map((experience, indice) => ({
    indice,
    poste: experience.poste,
    entreprise: experience.entreprise,
    description: experience.description,
    realisations: experience.realisations,
  }))
  const { ordre } = await moteur.genererObjet({
    nom: 'classement',
    schema: classementSchema,
    systeme: SYSTEME,
    utilisateur: `Poste visé : ${analyse.titreCible}\nMots-clés de l'offre : ${analyse.motsCles.join(', ')}\n${encadrer('profil', JSON.stringify(resume, null, 2))}`,
  })
  return completerPermutation(ordre, experiences.length)
}
