import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { AnalyseOffre } from './motsCles'

// Le titre du CV n'est pas rédigé par le modèle : il reprend l'intitulé de l'offre, nettoyé en code (voir pipeline.ts).
export const accrocheSchema = z.object({ accroche: z.string() })
export type Accroche = z.infer<typeof accrocheSchema>

const SYSTEME = `Tu es un expert en rédaction de CV optimisés pour les ATS.
Rédige l'"accroche" du profil fourni : 2 à 3 phrases (400 caractères maximum), à la première personne du singulier (« Je … »).
- Évite les adjectifs qui s'accordent au genre : préfère « je fais preuve de rigueur » à « je suis rigoureux ».
- Mets en avant EN PRIORITÉ les qualités et compétences transversales du profil qui correspondent aux « qualités demandées par l'offre » fournies, puis les outils et savoir-faire demandés, puis ce que les expériences apportent à ces exigences.
- N'utilise QUE les données fournies : ne décris aucune tâche, aucun outil ni aucun secteur qui n'y figure pas. S'il n'y a aucune réalisation, parle uniquement des qualités.
- N'affirme jamais exercer ou avoir exercé le poste visé. N'indique aucune durée d'expérience ni aucun chiffre qui ne figure pas tel quel dans les données.
- Les mots-clés de l'offre servent uniquement à choisir quoi mettre en avant : ne reprends jamais une mission, une qualité ou une responsabilité de l'offre qui n'apparaît pas dans le profil.

${REGLES_ANTI_INVENTION}`

// Étape 4 : accroche, rédigée à partir des seuls éléments conservés.
/** Ce que le modèle a le droit de mobiliser : uniquement ce qui répond à l'offre (le reste du profil est omis). */
export interface ContenuAccroche {
  /** Savoir-être du profil et compétences demandées par l'offre que le profil atteste. */
  competences: string[]
  /** Réalisations qui recoupent des termes de l'offre : jamais les autres tâches du profil. */
  realisations: string[]
}

export function redigerAccroche(moteur: MoteurLLM, contenu: ContenuAccroche, analyse: AnalyseOffre): Promise<Accroche> {
  return moteur.genererObjet({
    nom: 'accroche',
    schema: accrocheSchema,
    systeme: SYSTEME,
    utilisateur: `Poste visé : ${analyse.titreCible}\nQualités demandées par l'offre : ${analyse.qualites.join(', ') || '—'}\nOutils et savoir-faire demandés : ${analyse.competencesRequises.join(', ') || '—'}\n${encadrer('profil', JSON.stringify(contenu, null, 2))}`,
  })
}
