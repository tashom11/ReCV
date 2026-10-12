import { type Offre, offreSchema, type Profil, profilSchema } from '../schemas'
import type { MoteurLLM } from './moteur'
import { encadrer, PROMPT_EXTRACTION_OFFRE, PROMPT_EXTRACTION_PROFIL } from './prompts'

// Le texte brut est recopié en code : inutile (et risqué) de le faire régénérer par le LLM.
const offreExtraiteSchema = offreSchema.omit({ texteBrut: true })

export function extraireProfil(moteur: MoteurLLM, texteCv: string): Promise<Profil> {
  return moteur.genererObjet({
    nom: 'extraireProfil',
    schema: profilSchema,
    systeme: PROMPT_EXTRACTION_PROFIL,
    utilisateur: encadrer('cv', texteCv),
  })
}

export async function extraireOffre(moteur: MoteurLLM, texteOffre: string): Promise<Offre> {
  const extraite = await moteur.genererObjet({
    nom: 'extraireOffre',
    schema: offreExtraiteSchema,
    systeme: PROMPT_EXTRACTION_OFFRE,
    utilisateur: encadrer('offre', texteOffre),
  })
  return offreSchema.parse({ ...extraite, texteBrut: texteOffre })
}
