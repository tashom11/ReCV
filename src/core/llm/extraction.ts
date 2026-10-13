import { preparerTexteOffre } from '../offre/texte'
import { type Offre, offreSchema, type Profil, profilExtractionSchema } from '../schemas'
import { assainirProfil } from './assainissement'
import type { MoteurLLM } from './moteur'
import { encadrer, PROMPT_EXTRACTION_OFFRE, PROMPT_EXTRACTION_PROFIL } from './prompts'

// Le texte brut est recopié en code : inutile (et risqué) de le faire régénérer par le LLM.
const LONGUEUR_ENTETE_OFFRE = 1500

const offreExtraiteSchema = offreSchema.omit({ texteBrut: true })

export async function extraireProfil(moteur: MoteurLLM, texteCv: string): Promise<Profil> {
  const extrait = await moteur.genererObjet({
    nom: 'extraireProfil',
    schema: profilExtractionSchema,
    systeme: PROMPT_EXTRACTION_PROFIL,
    utilisateur: encadrer('cv', texteCv),
  })
  // Le modèle peut inventer des entrées : on ne garde que ce qui est attesté dans le texte du CV.
  return assainirProfil(extrait, texteCv)
}

export async function extraireOffre(moteur: MoteurLLM, texteOffre: string): Promise<Offre> {
  const extraite = await moteur.genererObjet({
    nom: 'extraireOffre',
    schema: offreExtraiteSchema,
    systeme: PROMPT_EXTRACTION_OFFRE,
    // Intitulé, entreprise et lieu figurent en tête d'annonce : inutile de faire lire (lentement) tout le texte.
    utilisateur: encadrer('offre', preparerTexteOffre(texteOffre, LONGUEUR_ENTETE_OFFRE)),
  })
  return offreSchema.parse({ ...extraite, texteBrut: texteOffre })
}
