import type { ApiReCV, EtatMiseAJour, ProgressionModele, ProgressionTache } from '@core/api'
import { CANAUX, encoderErreur, type ResultatIpc } from '@core/canaux'
import { contextBridge, type IpcRendererEvent, ipcRenderer, webUtils } from 'electron'

// API typée exposée au renderer : uniquement ces méthodes, jamais ipcRenderer lui-même.
async function appeler<T>(canal: string, ...args: unknown[]): Promise<T> {
  const resultat = (await ipcRenderer.invoke(canal, ...args)) as ResultatIpc<T>
  if (!resultat.ok) throw new Error(encoderErreur(resultat.message, resultat.code))
  return resultat.valeur
}

const api: ApiReCV = {
  importerCv: () => appeler(CANAUX.importerCv),
  // Le chemin d'un fichier déposé n'est lisible qu'ici : le renderer ne transmet que l'objet File.
  importerCvDepose: (fichier) => appeler(CANAUX.importerCvDepose, webUtils.getPathForFile(fichier as File)),
  obtenirProfil: () => appeler(CANAUX.obtenirProfil),
  enregistrerProfil: (profil) => appeler(CANAUX.enregistrerProfil, profil),
  recupererOffre: (url) => appeler(CANAUX.recupererOffre, url),
  analyserTexteOffre: (texte) => appeler(CANAUX.analyserTexteOffre, texte),
  analyserAnnonce: (offre) => appeler(CANAUX.analyserAnnonce, offre),
  adapterCv: (offre) => appeler(CANAUX.adapterCv, offre),
  annulerAdaptation: () => appeler(CANAUX.annulerAdaptation),
  ouvrirFichier: (chemin) => appeler(CANAUX.ouvrirFichier, chemin),
  montrerDansDossier: (chemin) => appeler(CANAUX.montrerDansDossier, chemin),
  lireParametres: () => appeler(CANAUX.lireParametres),
  enregistrerParametres: (parametres) => appeler(CANAUX.enregistrerParametres, parametres),
  definirCleApi: (cle) => appeler(CANAUX.definirCleApi, cle),
  exporterCv: (cv, format, modeleId) => appeler(CANAUX.exporterCv, cv, format, modeleId),
  htmlModeleCv: (cv, modeleId) => appeler(CANAUX.htmlModeleCv, cv, modeleId),
  genererAccroche: (profil) => appeler(CANAUX.genererAccroche, profil),
  lireEtatModeles: () => appeler(CANAUX.lireEtatModeles),
  telechargerModele: (id) => appeler(CANAUX.telechargerModele, id),
  annulerTelechargement: () => appeler(CANAUX.annulerTelechargement),
  supprimerModele: (id) => appeler(CANAUX.supprimerModele, id),
  effacerDonnees: () => appeler(CANAUX.effacerDonnees),
  lireEtatMiseAJour: () => appeler(CANAUX.lireEtatMiseAJour),
  verifierMiseAJour: () => appeler(CANAUX.verifierMiseAJour),
  installerMiseAJour: () => appeler(CANAUX.installerMiseAJour),
  surMiseAJour: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, etat: EtatMiseAJour) => rappel(etat)
    ipcRenderer.on(CANAUX.etatMiseAJour, ecouteur)
    return () => ipcRenderer.removeListener(CANAUX.etatMiseAJour, ecouteur)
  },
  surProgressionTache: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, progression: ProgressionTache) => rappel(progression)
    ipcRenderer.on(CANAUX.progressionTache, ecouteur)
    return () => ipcRenderer.removeListener(CANAUX.progressionTache, ecouteur)
  },
  surProgressionModele: (rappel) => {
    const ecouteur = (_e: IpcRendererEvent, progression: ProgressionModele) => rappel(progression)
    ipcRenderer.on(CANAUX.progressionModele, ecouteur)
    return () => ipcRenderer.removeListener(CANAUX.progressionModele, ecouteur)
  },
}

contextBridge.exposeInMainWorld('api', api)
