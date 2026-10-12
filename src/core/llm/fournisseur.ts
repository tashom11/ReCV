import type { CvAdapte, Offre, Profil } from '../schemas'

export interface FournisseurLLM {
  extraireProfil(texteCv: string): Promise<Profil>
  extraireOffre(texteOffre: string): Promise<Offre>
  adapterCv(profil: Profil, offre: Offre): Promise<CvAdapte>
  /** Libère les ressources natives (modèle local) ; absent pour les fournisseurs distants. */
  liberer?(): Promise<void>
}
