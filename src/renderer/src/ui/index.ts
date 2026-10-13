export { Alerte, Confirmation } from './Alerte'
export { Bouton, BoutonLien } from './Bouton'
export { CaseACocher, Champ, Selection } from './Champ'
export { Etapes, type NumeroEtape } from './Etapes'
export { IllustrationCv } from './IllustrationCv'
export { Icone, type NomIcone, Spinner } from './icones'
export {
  BarreActions,
  Carte,
  Chargement,
  EtatVide,
  OngletsSegmentes,
  Pastille,
  SectionRepliable,
  Titre,
  VignetteModele,
} from './structure'
export { ZoneDepot } from './ZoneDepot'

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
