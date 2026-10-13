import type { Parametres } from '@core/api'
import type { CleEtape } from '@core/etapes'

// Règles du parcours en trois étapes, sans React ni accès à l'application : testables seules.

export type Vue = 'accueil' | 'preparation' | 'cv' | 'annonce' | 'creation' | 'resultat' | 'succes' | 'reglages'
export type NumeroEtape = 1 | 2 | 3

export interface EtatParcours {
  profilPresent: boolean
  /** L'annonce a été lue et confirmée par « Créer mon CV adapté ». */
  annonceConfirmee: boolean
  /** Un CV adapté a été téléchargé. */
  exporte: boolean
}

/** À l'ouverture : l'accueil seulement s'il n'y a encore aucun CV, sinon directement l'annonce. */
export function vueInitiale(profilPresent: boolean): Vue {
  return profilPresent ? 'annonce' : 'accueil'
}

/** Le moteur peut travailler : service configuré, ou modèle présent sur l'ordinateur. */
export function moteurPret(
  parametres: Pick<Parametres, 'fournisseur' | 'cheminModeleLocal'>,
  modeles: readonly { installe: boolean }[],
): boolean {
  if (parametres.fournisseur !== 'local') return true
  return Boolean(parametres.cheminModeleLocal) || modeles.some((m) => m.installe)
}

/** Après « Commencer » : la préparation si le moteur manque, sinon l'étape ①. */
export function apresCommencer(pret: boolean): Vue {
  return pret ? 'cv' : 'preparation'
}

export function etapeDeVue(vue: Vue): NumeroEtape | null {
  switch (vue) {
    case 'cv':
      return 1
    case 'annonce':
      return 2
    case 'creation':
    case 'resultat':
      return 3
    default:
      return null
  }
}

export function vueDeEtape(etape: NumeroEtape): Vue {
  return etape === 1 ? 'cv' : etape === 2 ? 'annonce' : 'resultat'
}

export function etapesFaites(etat: EtatParcours): NumeroEtape[] {
  const faites: NumeroEtape[] = []
  if (etat.profilPresent) faites.push(1)
  if (etat.profilPresent && etat.annonceConfirmee) faites.push(2)
  if (faites.length === 2 && etat.exporte) faites.push(3)
  return faites
}

/** Ce que l'en-tête montre pour une vue : les étapes sont hors sujet à l'accueil, les réglages pendant une attente. */
export function enteteDeVue(vue: Vue): { etapes: boolean; reglages: boolean } {
  return {
    etapes: vue !== 'accueil' && vue !== 'preparation' && vue !== 'reglages',
    reglages: vue !== 'preparation' && vue !== 'creation' && vue !== 'succes' && vue !== 'reglages',
  }
}

/** Étapes de la création, dans les mots de l'utilisateur. */
export const ETAPES_CREATION = [
  'Je lis l’annonce',
  'Je choisis ce qui vous met en valeur',
  'J’écris votre phrase de présentation',
  'Je mets votre CV en page',
] as const

const RANG_CLE: Record<CleEtape, number> = { preparation: 0, analyse: 0, selection: 1, reformulation: 1, accroche: 2 }

/**
 * Rang (0 à 3) de l'étape de création en cours. L'annonce déjà lue à l'étape ② n'est pas relue :
 * la première ligne est alors faite d'emblée.
 */
export function etapeCreationCourante(cle: CleEtape | undefined, annonceLue: boolean, miseEnPage: boolean): number {
  if (miseEnPage) return 3
  const rang = cle ? RANG_CLE[cle] : 0
  return annonceLue ? Math.max(1, rang) : rang
}

const DOSSIERS_CONNUS: Record<string, string> = {
  desktop: 'sur votre Bureau',
  bureau: 'sur votre Bureau',
  documents: 'dans vos Documents',
  downloads: 'dans vos Téléchargements',
  téléchargements: 'dans vos Téléchargements',
}

/** Nom du fichier et dossier d'enregistrement, dits simplement (« Enregistré sur votre Bureau »). */
export function lieuEnregistrement(chemin: string): { fichier: string; lieu: string } {
  const morceaux = chemin.split(/[\\/]/).filter(Boolean)
  const fichier = morceaux.pop() ?? chemin
  const dossier = morceaux.pop()
  if (!dossier) return { fichier, lieu: 'Enregistré sur votre ordinateur' }
  const connu = DOSSIERS_CONNUS[dossier.toLowerCase()]
  return { fichier, lieu: connu ? `Enregistré ${connu}` : `Enregistré dans le dossier « ${dossier} »` }
}

/** Initiales affichées dans la pastille du résumé (« Camille Martin » → « CM »). */
export function initiales(nom: string | undefined): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  const premier = mots[0]?.charAt(0) ?? ''
  const dernier = mots.length > 1 ? (mots[mots.length - 1]?.charAt(0) ?? '') : ''
  return (premier + dernier).toLocaleUpperCase('fr-FR')
}

/** « 3 expériences », « 1 formation » : le nombre et le nom accordé, séparés pour mettre le nombre en gras. */
export function compter(nombre: number, singulier: string, pluriel: string): { nombre: number; nom: string } {
  return { nombre, nom: nombre > 1 ? pluriel : singulier }
}

/** Intitulé du poste sans la mention « H/F », avec ou sans parenthèses : pour le citer dans une phrase. */
export function titreSansMention(titre: string): string {
  const sans = titre
    .replace(/\s*[-–—]?\s*[([]?\s*\b[hfx]\s*\/\s*[hfx](\s*\/\s*[hfx])?\b\s*[)\]]?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return sans || titre
}
