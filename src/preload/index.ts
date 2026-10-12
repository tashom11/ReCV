import type { ApiReCV } from '@core/api'
import { CANAUX, type ResultatIpc } from '@core/canaux'
import { contextBridge, ipcRenderer } from 'electron'

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
}

contextBridge.exposeInMainWorld('api', api)
