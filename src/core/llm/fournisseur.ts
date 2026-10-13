import type { CvAdapte, Offre, Profil } from '../schemas'

/** Étape d'un traitement long, pour l'affichage de la progression. */
export interface EtapeAdaptation {
  etape: string
  courant?: number
  total?: number
}

export interface OptionsAdaptation {
  surEtape?: (etape: EtapeAdaptation) => void
}

export interface FournisseurLLM {
  extraireProfil(texteCv: string): Promise<Profil>
  extraireOffre(texteOffre: string): Promise<Offre>
  adapterCv(profil: Profil, offre: Offre, options?: OptionsAdaptation): Promise<CvAdapte>
  /** Accroche générique du profil, fondée sur ses seules compétences transversales (savoir-être). */
  genererAccroche(profil: Profil): Promise<string>
  /** Libère les ressources natives (modèle local) ; absent pour les fournisseurs distants. */
  liberer?(): Promise<void>
}
