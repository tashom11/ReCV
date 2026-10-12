// Sans dépendance (pas de zod) : importé tel quel par le preload sandboxé.

/** Canaux IPC (un par méthode de l'API). */
export const CANAUX = {
  importerCv: 'cv:importer',
  obtenirProfil: 'profil:obtenir',
  enregistrerProfil: 'profil:enregistrer',
  recupererOffre: 'offre:recuperer',
  analyserTexteOffre: 'offre:analyser-texte',
  adapterCv: 'cv:adapter',
  lireParametres: 'parametres:lire',
  enregistrerParametres: 'parametres:enregistrer',
  definirCleApi: 'parametres:definir-cle',
  exporterCv: 'cv:exporter',
  lireEtatModeles: 'modeles:etat',
  telechargerModele: 'modeles:telecharger',
  annulerTelechargement: 'modeles:annuler',
  supprimerModele: 'modeles:supprimer',
  progressionModele: 'modeles:progression',
} as const

/** Enveloppe sérialisable : les erreurs traversent l'IPC avec un message lisible. */
export type ResultatIpc<T> = { ok: true; valeur: T } | { ok: false; message: string; code?: string }
