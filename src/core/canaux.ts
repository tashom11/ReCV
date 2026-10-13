// Sans dépendance (pas de zod) : importé tel quel par le preload sandboxé.

/** Canaux IPC (un par méthode de l'API). */
export const CANAUX = {
  importerCv: 'cv:importer',
  importerCvDepose: 'cv:importer-depose',
  obtenirProfil: 'profil:obtenir',
  enregistrerProfil: 'profil:enregistrer',
  recupererOffre: 'offre:recuperer',
  analyserTexteOffre: 'offre:analyser-texte',
  analyserAnnonce: 'offre:analyser-annonce',
  adapterCv: 'cv:adapter',
  annulerAdaptation: 'cv:annuler-adaptation',
  lireParametres: 'parametres:lire',
  enregistrerParametres: 'parametres:enregistrer',
  definirCleApi: 'parametres:definir-cle',
  exporterCv: 'cv:exporter',
  htmlModeleCv: 'cv:html-modele',
  ouvrirFichier: 'fichier:ouvrir',
  montrerDansDossier: 'fichier:montrer',
  genererAccroche: 'profil:generer-accroche',
  lireEtatModeles: 'modeles:etat',
  telechargerModele: 'modeles:telecharger',
  annulerTelechargement: 'modeles:annuler',
  supprimerModele: 'modeles:supprimer',
  progressionModele: 'modeles:progression',
  progressionTache: 'taches:progression',
  effacerDonnees: 'donnees:effacer',
} as const

/** Enveloppe sérialisable : les erreurs traversent l'IPC avec un message lisible. */
export type ResultatIpc<T> = { ok: true; valeur: T } | { ok: false; message: string; code?: string }
