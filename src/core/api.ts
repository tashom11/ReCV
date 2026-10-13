import { z } from 'zod'

export { CANAUX, type ResultatIpc } from './canaux'

import { IDS_MODELES } from './export/modeles'
import { type CvAdapte, cvAdapteSchema, type Offre, offreSchema, type Profil, profilSchema } from './schemas'

// Contrat IPC partagé entre `src/main` (handlers), `src/preload` (pont) et `src/renderer` (appels).

const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '[::1]'])

function analyserUrl(valeur: string): URL | null {
  try {
    const url = new URL(valeur)
    const http = url.protocol === 'http:' || url.protocol === 'https:'
    return http && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

// Une URL de service est une destination de données personnelles (et de la clé API) : on la valide.
const urlService = z
  .string()
  .max(2048)
  .refine((v) => analyserUrl(v) !== null, 'Adresse invalide : une URL http(s) sans identifiants est attendue.')

const urlApiSure = urlService.refine((v) => {
  const url = analyserUrl(v)
  return url !== null && (url.protocol === 'https:' || HOTES_LOCAUX.has(url.hostname))
}, 'L’adresse de l’API doit être en https (http n’est accepté que pour localhost).')

export const parametresSchema = z.object({
  fournisseur: z.enum(['ollama', 'api', 'local']).default('local'),
  modeleOllama: z.string().max(200).default('qwen3:8b'),
  urlOllama: urlService.default('http://localhost:11434/v1'),
  urlApi: urlApiSure.default('https://api.openai.com/v1'),
  modeleApi: z.string().max(200).default(''),
  /** Reformuler les puces avec le modèle (plus lent). Par défaut : sélection des puces, sans modèle. */
  reformulerPuces: z.boolean().default(false),
  /** Modèle de mise en page du CV exporté (voir `core/export/modeles.ts`). */
  modeleCv: z.enum(IDS_MODELES).default('classique'),
  cheminModeleLocal: z
    .string()
    .max(1024)
    .refine((v) => v === '' || v.toLowerCase().endsWith('.gguf'), 'Le modèle local doit être un fichier .gguf.')
    .optional(),
})

/** Origine (schéma + hôte + port) d'une URL de service, pour détecter un changement de destination. */
export function origineUrl(valeur: string): string | null {
  return analyserUrl(valeur)?.origin ?? null
}
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

/** Étape en cours d'une tâche longue (import du CV, analyse d'offre, adaptation) : le renderer l'affiche. */
export interface ProgressionTache {
  tache: 'import' | 'offre' | 'adaptation' | 'accroche'
  /** Libellé lisible, ex. « Réécriture des expériences ». */
  etape: string
  courant?: number
  total?: number
  /** Où tourne le modèle embarqué : sur le processeur, le calcul est bien plus lent. */
  calcul?: 'gpu' | 'cpu'
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
  exporterCv(cv: CvAdapte, format: FormatExport, modeleId?: string): Promise<string | null>
  /** HTML complet du CV mis en page avec un modèle (photo comprise), à afficher dans un cadre isolé. */
  htmlModeleCv(cv: CvAdapte, modeleId: string): Promise<string>
  /** Accroche générique fondée sur les compétences transversales du profil fourni (même non enregistré). */
  genererAccroche(profil: Profil): Promise<string>
  /** Chaîne vide : supprime la clé. */
  definirCleApi(cle: string): Promise<EtatParametres>
  lireEtatModeles(): Promise<EtatModeles>
  /** Résout quand le fichier est téléchargé, vérifié et sélectionné dans les paramètres. */
  telechargerModele(id: string): Promise<void>
  annulerTelechargement(): Promise<void>
  supprimerModele(id: string): Promise<void>
  /** Supprime profil, offres, CV générés et clé API. Les paramètres et modèles sont conservés. */
  effacerDonnees(): Promise<void>
}

/** API complète vue par le renderer. */
export interface ApiReCV extends ApiService {
  /** Retourne la fonction de désabonnement. */
  surProgressionModele(rappel: (progression: ProgressionModele) => void): () => void
  /** Étapes des tâches longues (adaptation…). Retourne la fonction de désabonnement. */
  surProgressionTache(rappel: (progression: ProgressionTache) => void): () => void
}

// Bornes de taille : le renderer n'est pas fiable (les schémas métier eux-mêmes ne sont pas bornés,
// car ils valident aussi les sorties du LLM).
const TAILLE_MAX_JSON = 500_000
const borne = <T extends z.ZodType>(schema: T) =>
  schema.refine((v) => JSON.stringify(v).length <= TAILLE_MAX_JSON, 'Données trop volumineuses.')

export const entreesIpc = {
  cv: borne(cvAdapteSchema),
  format: z.enum(['pdf', 'docx']),
  idModeleCv: z.enum(IDS_MODELES),
  profil: borne(profilSchema),
  offre: borne(offreSchema),
  parametres: parametresSchema,
  texte: z.string().min(1).max(200_000),
  url: z.string().min(1).max(2_048),
  cle: z.string().max(1_024),
  idModele: z.string().min(1).max(64),
}
