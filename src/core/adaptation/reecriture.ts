import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Experience } from '../schemas'
import { type AnalyseOffre, restreindreAnalyse } from './motsCles'
import { contientMot, nombres, normaliser, texteExperience } from './texte'

export const reecritureSchema = z.object({ points: z.array(z.string()).default([]) })

const systeme = (maxPoints: number) => `Tu es un expert en rédaction de CV optimisés pour les ATS.
Réécris l'expérience fournie en au plus ${maxPoints} puces ("points") :
- commence chaque puce par un verbe d'action, une idée par puce, phrases courtes ;
- mets en avant ce qui correspond aux mots-clés de l'offre, en reprenant leur formulation UNIQUEMENT s'ils décrivent fidèlement ce que contient déjà l'expérience ;
- ne mentionne jamais un outil, une technologie ou une compétence absente de l'expérience, même si l'offre le demande ;
- conserve les chiffres exacts, n'en crée aucun.

${REGLES_ANTI_INVENTION}`

// Un petit modèle peut laisser de la ponctuation JSON dans une puce (« ,Collaboration… », « ], »).
// On retire ces résidus aux extrémités ; une puce sans mot exploitable est abandonnée (chaîne vide).
export function nettoyerPoint(point: string): string {
  const propre = point
    .replace(/^[\s,;:.\][{}()"'`•*–—-]+/u, '')
    .replace(/[\s,;:\][{}("'`]+$/u, '')
    .trim()
  return /\p{L}{3,}/u.test(propre) ? propre : ''
}

// Points d'origine du profil, utilisés si le LLM ne renvoie rien d'exploitable.
export function pointsOrigine(experience: Experience): string[] {
  if (experience.realisations.length > 0) return experience.realisations
  return experience.description ? [experience.description] : []
}

// Garde-fou : rejette une puce qui cite un terme de l'offre absent de l'expérience,
// ou un nombre absent de la source (chiffre inventé).
export function pointFidele(point: string, texteSource: string, termesAbsents: string[]): boolean {
  const texte = normaliser(point)
  if (termesAbsents.some((terme) => contientMot(texte, normaliser(terme)))) return false
  const nombresSource = new Set(nombres(texteSource))
  return nombres(point).every((nombre) => nombresSource.has(nombre))
}

// Étape 3 : réécriture d'UNE expérience (appelée expérience par expérience).
export async function reecrireExperience(
  moteur: MoteurLLM,
  experience: Experience,
  analyseComplete: AnalyseOffre,
  maxPoints: number,
): Promise<string[]> {
  if (pointsOrigine(experience).length === 0) return []
  const source = texteExperience(experience)
  // Le LLM ne reçoit que les mots-clés que l'expérience contient déjà.
  const analyse = restreindreAnalyse(analyseComplete, source)
  const termesAbsents = [...analyseComplete.motsCles, ...analyseComplete.competencesRequises].filter(
    (terme) => !analyse.motsCles.includes(terme) && !analyse.competencesRequises.includes(terme),
  )
  const contenu = {
    poste: experience.poste,
    entreprise: experience.entreprise,
    description: experience.description,
    realisations: experience.realisations,
  }
  const { points } = await moteur.genererObjet({
    nom: 'reecriture',
    schema: reecritureSchema,
    systeme: systeme(maxPoints),
    utilisateur: `Poste visé : ${analyse.titreCible}\nMots-clés de l'offre : ${analyse.motsCles.join(', ')}\n${encadrer('experience', JSON.stringify(contenu, null, 2))}`,
  })
  const nettoyes = points
    .map(nettoyerPoint)
    .filter((point) => point.length > 0 && pointFidele(point, source, termesAbsents))
  return nettoyes.length > 0 ? nettoyes.slice(0, maxPoints) : pointsOrigine(experience)
}
