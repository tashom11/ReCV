import type { JobPosting, Profile, TailoredCv } from '../schemas'
import type { StepKey } from '../steps'
import type { JobAnalysis } from '../tailoring/jobAnalysis'

/** Étape d'un traitement long, pour l'affichage de la progression. */
export interface TailoringStep {
  key?: StepKey
  label: string
  current?: number
  total?: number
}

export interface TailoringOptions {
  onStep?: (label: TailoringStep) => void
  /** Reformuler les puces avec le modèle (lent). Par défaut : sélection des puces d'origine, sans modèle. */
  rewrite?: boolean
  /** Analyse de l'offre déjà connue (elle ne dépend pas du profil) : évite l'appel au modèle. */
  analysis?: JobAnalysis
  /** Reçoit l'analyse calculée, pour la mémoriser. */
  onAnalysis?: (analysis: JobAnalysis) => void
  /** Annulation : vérifiée entre les étapes et transmise au moteur. */
  signal?: AbortSignal
}

export interface LlmProvider {
  extractProfile(cvText: string): Promise<Profile>
  extractJobPosting(jobPostingText: string): Promise<JobPosting>
  /** Exigences de l'offre (compétences, qualités, prérequis) : première étape de l'adaptation, réutilisable. */
  analyzeJobPosting(jobPosting: JobPosting): Promise<JobAnalysis>
  tailorCv(profile: Profile, jobPosting: JobPosting, options?: TailoringOptions): Promise<TailoredCv>
  /** Accroche générique du profil, fondée sur ses seules compétences transversales (savoir-être). */
  generateSummary(profile: Profile): Promise<string>
  /** Où tourne le calcul (modèle embarqué uniquement). */
  computeMode?(): 'gpu' | 'cpu' | null
  /** Libère les ressources natives (modèle local) ; absent pour les fournisseurs distants. */
  release?(): Promise<void>
}

export type { StepKey } from '../steps'
