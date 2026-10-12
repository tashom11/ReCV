import { z } from 'zod'

export { CANAUX, type ResultatIpc } from './canaux'

import { type CvAdapte, type Offre, offreSchema, type Profil, profilSchema } from './schemas'

// Contrat IPC partagé entre `src/main` (handlers), `src/preload` (pont) et `src/renderer` (appels).

export const parametresSchema = z.object({
  fournisseur: z.enum(['ollama', 'api', 'local']).default('ollama'),
  modeleOllama: z.string().default('qwen3:8b'),
  urlOllama: z.string().default('http://localhost:11434/v1'),
  urlApi: z.string().default('https://api.openai.com/v1'),
  modeleApi: z.string().default(''),
  cheminModeleLocal: z.string().optional(),
})
export type Parametres = z.infer<typeof parametresSchema>

export interface EtatParametres extends Parametres {
  /** La clé elle-même ne quitte jamais le process principal. */
  cleApiDefinie: boolean
}

export interface ProfilEnregistre {
  id: number
  profil: Profil
}

export interface CvGenere {
  id: number
  offreId: number
  cv: CvAdapte
}

export interface ApiReCV {
  /** Ouvre le sélecteur de fichier (PDF/DOCX), extrait le profil et l'enregistre. `null` si annulé. */
  importerCv(): Promise<ProfilEnregistre | null>
  obtenirProfil(): Promise<ProfilEnregistre | null>
  enregistrerProfil(profil: Profil): Promise<ProfilEnregistre>
  recupererOffre(url: string): Promise<Offre>
  analyserTexteOffre(texte: string): Promise<Offre>
  /** Adapte le profil enregistré à l'offre, puis enregistre l'offre et le CV obtenu. */
  adapterCv(offre: Offre): Promise<CvGenere>
  lireParametres(): Promise<EtatParametres>
  enregistrerParametres(parametres: Parametres): Promise<EtatParametres>
  /** Chaîne vide : supprime la clé. */
  definirCleApi(cle: string): Promise<EtatParametres>
}

export const entreesIpc = {
  profil: profilSchema,
  offre: offreSchema,
  parametres: parametresSchema,
  texte: z.string().min(1).max(200_000),
  url: z.string().min(1).max(2_048),
  cle: z.string().max(1_024),
}
