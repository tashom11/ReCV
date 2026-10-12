import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { ExperienceAdaptee, Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'

export const titreAccrocheSchema = z.object({ titre: z.string(), accroche: z.string() })
export type TitreAccroche = z.infer<typeof titreAccrocheSchema>

const SYSTEME = `Tu es un expert en rédaction de CV optimisés pour les ATS.
Rédige pour le profil fourni :
- "titre" : l'intitulé du CV (8 mots maximum). Reprends le poste visé seulement si les expériences du profil le justifient ; sinon garde un intitulé fidèle au profil ;
- "accroche" : 2 à 3 phrases (400 caractères maximum), sans « je », qui résument le profil en mettant en avant ce qui correspond à l'offre.
L'accroche ne cite que des expériences, compétences, durées et résultats présents dans le profil.
Les mots-clés de l'offre servent uniquement à choisir quoi mettre en avant : ne reprends jamais une mission, une qualité ou une responsabilité de l'offre qui n'apparaît pas dans le profil.

${REGLES_ANTI_INVENTION}`

// Étape 4 : titre + accroche, rédigés après la réécriture des expériences.
export function redigerTitreAccroche(
  moteur: MoteurLLM,
  profil: Profil,
  experiences: ExperienceAdaptee[],
  analyse: AnalyseOffre,
): Promise<TitreAccroche> {
  const contenu = {
    titreActuel: profil.titrePoste,
    accrocheActuelle: profil.accroche,
    experiences: experiences.map(({ poste, entreprise, periode, points }) => ({ poste, entreprise, periode, points })),
    competences: profil.competences,
    formations: profil.formations.map(({ diplome, etablissement }) => ({ diplome, etablissement })),
  }
  return moteur.genererObjet({
    nom: 'titreAccroche',
    schema: titreAccrocheSchema,
    systeme: SYSTEME,
    utilisateur: `Poste visé : ${analyse.titreCible}\nMots-clés de l'offre : ${analyse.motsCles.join(', ')}\n${encadrer('profil', JSON.stringify(contenu, null, 2))}`,
  })
}
