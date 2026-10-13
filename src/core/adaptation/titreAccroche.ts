import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { ExperienceAdaptee, Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'

// Le titre du CV n'est pas rédigé par le modèle : il reprend l'intitulé de l'offre, nettoyé en code (voir pipeline.ts).
export const accrocheSchema = z.object({ accroche: z.string() })
export type Accroche = z.infer<typeof accrocheSchema>

const SYSTEME = `Tu es un expert en rédaction de CV optimisés pour les ATS.
Rédige l'"accroche" du profil fourni : 2 à 3 phrases (400 caractères maximum), à la première personne du singulier (« Je … »).
- Évite les adjectifs qui s'accordent au genre : préfère « je fais preuve de rigueur » à « je suis rigoureux ».
- Mets en avant EN PRIORITÉ les qualités et compétences transversales du profil qui correspondent aux « qualités demandées par l'offre » fournies, puis les outils et savoir-faire demandés, puis ce que les expériences apportent à ces exigences.
- N'affirme jamais exercer ou avoir exercé le poste visé s'il n'apparaît pas dans les expériences. N'indique aucune durée d'expérience ni aucun chiffre qui ne figure pas tel quel dans les données.
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
