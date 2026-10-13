import type { ApiReCV, ProgressionModele, ProgressionTache } from '@core/api'
import { CANAUX, type ResultatIpc } from '@core/canaux'
import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron'

// API typée exposée au renderer : uniquement ces méthodes, jamais ipcRenderer lui-même.
async function appeler<T>(canal: string, ...args: unknown[]): Promise<T> {
  const resultat = (await ipcRenderer.invoke(canal, ...args)) as ResultatIpc<T>
  if (!resultat.ok) throw Object.assign(new Error(resultat.message), { code: resultat.code })
  return resultat.valeur
}

const api: ApiReCV = {
  importerCv: () => appeler(CANAUX.importerCv),
  obtenirProfil: () => appeler(CANAUX.obtenirProfil),
  enregistrerProfil: (profil) => appeler(CANAUX.enregistrerProfil, profil),
  recupererOffre: (url) => appeler(CANAUX.recupererOffre, url),
  analyserTexteOffre: (texte) => appeler(CANAUX.analyserTexteOffre, texte),
  adapterCv: (offre) => appeler(CANAUX.adapterCv, offre),
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
