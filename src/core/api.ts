import { z } from 'zod'

export { CANAUX, type ResultatIpc } from './canaux'

import { type CvAdapte, cvAdapteSchema, type Offre, offreSchema, type Profil, profilSchema } from './schemas'

// Contrat IPC partagé entre `src/main` (handlers), `src/preload` (pont) et `src/renderer` (appels).

export const parametresSchema = z.object({
  fournisseur: z.enum(['ollama', 'api', 'local']).default('local'),
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

export type FormatExport = 'pdf' | 'docx'

export interface CvGenere {
  id: number
  offreId: number
  cv: CvAdapte
}

export interface ModeleEmbarqueEtat {
  id: string
  nom: string
  description: string
  tailleOctets: number
  chemin: string
  installe: boolean
  /** Adapté à la mémoire détectée sur cette machine. */
  recommande: boolean
  compatible: boolean
}

export interface ProgressionModele {
  id: string
  recuOctets: number
  totalOctets: number
  etat: 'en-cours' | 'verification' | 'termine' | 'erreur' | 'annule'
  message?: string
}

export interface EtatModeles {
  ramGo: number
  vramGo: number
  modeles: ModeleEmbarqueEtat[]
  /** Téléchargement en cours (ou dernier état connu pendant celui-ci). */
  telechargement: ProgressionModele | null
}

/** Méthodes requête/réponse, implémentées par le service du process principal. */
export interface ApiService {
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
  /** Enregistre le CV validé (coordonnées du profil actif) via un sélecteur de fichier. Chemin écrit, ou `null` si annulé. */
  exporterCv(cv: CvAdapte, format: FormatExport): Promise<string | null>
  /** Chaîne vide : supprime la clé. */
  definirCleApi(cle: string): Promise<EtatParametres>
  lireEtatModeles(): Promise<EtatModeles>
  /** Résout quand le fichier est téléchargé, vérifié et sélectionné dans les paramètres. */
  telechargerModele(id: string): Promise<void>
  annulerTelechargement(): Promise<void>
  supprimerModele(id: string): Promise<void>
}

/** API complète vue par le renderer. */
export interface ApiReCV extends ApiService {
  /** Retourne la fonction de désabonnement. */
  surProgressionModele(rappel: (progression: ProgressionModele) => void): () => void
}

export const entreesIpc = {
  cv: cvAdapteSchema,
  format: z.enum(['pdf', 'docx']),
  profil: profilSchema,
  offre: offreSchema,
  parametres: parametresSchema,
  texte: z.string().min(1).max(200_000),
  url: z.string().min(1).max(2_048),
  cle: z.string().max(1_024),
  idModele: z.string().min(1).max(64),
}
