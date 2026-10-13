import type { AnalyseOffre } from '../adaptation/motsCles'
import type { CvAdapte, Offre, Profil } from '../schemas'

/** Étape d'un traitement long, pour l'affichage de la progression. */
export interface EtapeAdaptation {
  etape: string
  courant?: number
  total?: number
}

export interface OptionsAdaptation {
  surEtape?: (etape: EtapeAdaptation) => void
  /** Reformuler les puces avec le modèle (lent). Par défaut : sélection des puces d'origine, sans modèle. */
  reformuler?: boolean
  /** Analyse de l'offre déjà connue (elle ne dépend pas du profil) : évite l'appel au modèle. */
  analyse?: AnalyseOffre
  /** Reçoit l'analyse calculée, pour la mémoriser. */
  surAnalyse?: (analyse: AnalyseOffre) => void
}

export interface FournisseurLLM {
  extraireProfil(texteCv: string): Promise<Profil>
  extraireOffre(texteOffre: string): Promise<Offre>
  adapterCv(profil: Profil, offre: Offre, options?: OptionsAdaptation): Promise<CvAdapte>
  /** Accroche générique du profil, fondée sur ses seules compétences transversales (savoir-être). */
  genererAccroche(profil: Profil): Promise<string>
  /** Où tourne le calcul (modèle embarqué uniquement). */
  modeCalcul?(): 'gpu' | 'cpu' | null
  /** Libère les ressources natives (modèle local) ; absent pour les fournisseurs distants. */
  liberer?(): Promise<void>
}
