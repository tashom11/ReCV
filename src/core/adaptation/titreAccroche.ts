import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { ExperienceAdaptee, Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'

// Le titre du CV n'est plus rédigé par le modèle : un titre « Community Manager » sur le CV d'un
// développeur serait un faux. Il est choisi en code parmi les intitulés du profil (voir pipeline.ts).
export const accrocheSchema = z.object({ accroche: z.string() })
export type Accroche = z.infer<typeof accrocheSchema>

const SYSTEME = `Tu es un expert en rédaction de CV optimisés pour les ATS.
Rédige l'"accroche" du profil fourni : 2 à 3 phrases (400 caractères maximum), sans « je », qui présentent honnêtement le candidat à partir de son parcours réel.
- Mets en avant, parmi les éléments fournis, ceux qui répondent aux activités et exigences de l'offre.
- Désigne le candidat par le métier qu'il a réellement exercé (les intitulés des expériences fournies). N'affirme jamais qu'il exerce ou a exercé le poste visé s'il n'apparaît pas dans ses expériences.
- N'indique aucune durée d'expérience (« X ans ») et ne cite aucun chiffre qui ne figure pas tel quel dans les données.
- Les mots-clés de l'offre servent uniquement à choisir quoi mettre en avant : ne reprends jamais une mission, une qualité ou une responsabilité de l'offre qui n'apparaît pas dans le profil.

${REGLES_ANTI_INVENTION}`

// Étape 4 : accroche, rédigée à partir des seuls éléments conservés.
export function redigerAccroche(
  moteur: MoteurLLM,
  profil: Profil,
  experiences: ExperienceAdaptee[],
  analyse: AnalyseOffre,
): Promise<Accroche> {
  const contenu = {
    titreActuel: profil.titrePoste,
    accrocheActuelle: profil.accroche,
    experiences: experiences.map(({ poste, entreprise, periode, points }) => ({ poste, entreprise, periode, points })),
    competences: profil.competences,
    formations: profil.formations.map(({ diplome, etablissement }) => ({ diplome, etablissement })),
  }
  return moteur.genererObjet({
    nom: 'accroche',
    schema: accrocheSchema,
    systeme: SYSTEME,
    utilisateur: `Poste visé : ${analyse.titreCible}\nMots-clés de l'offre : ${analyse.motsCles.join(', ')}\n${encadrer('profil', JSON.stringify(contenu, null, 2))}`,
  })
}
