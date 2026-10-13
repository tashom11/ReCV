import { type ApiService, CANAUX, entreesIpc, type ResultatIpc } from '@core/api'
import { ErreurRecuperationOffre } from '@core/offre'
import type { IpcMain } from 'electron'
import type { ZodType } from 'zod'

function analyser<T>(schema: ZodType<T>, valeur: unknown): T {
  const resultat = schema.safeParse(valeur)
  if (!resultat.success) throw new Error('Données invalides reçues par le process principal.')
  return resultat.data
}

function enveloppe(erreur: unknown): ResultatIpc<never> {
  if (erreur instanceof ErreurRecuperationOffre) return { ok: false, message: erreur.message, code: erreur.code }
  return { ok: false, message: erreur instanceof Error ? erreur.message : String(erreur) }
}

/**
 * Branche l'API sur ipcMain. Chaque entrée du renderer est revalidée par Zod :
 * le renderer n'est jamais considéré comme fiable.
 */
export function enregistrerHandlers(
  ipcMain: IpcMain,
  api: ApiService,
  /** Reçoit l'URL de la frame appelante ; refuse tout ce qui n'est pas l'interface de l'application. */
  expediteurAutorise: (url: string) => boolean = () => true,
): void {
  const gerer = (canal: string, traitement: (...args: unknown[]) => Promise<unknown>) => {
    ipcMain.handle(canal, async (evenement, ...args): Promise<ResultatIpc<unknown>> => {
      try {
        if (!expediteurAutorise(evenement.senderFrame?.url ?? '')) throw new Error('Appel IPC refusé.')
        return { ok: true, valeur: await traitement(...args) }
      } catch (erreur) {
        return enveloppe(erreur)
      }
    })
  }

  gerer(CANAUX.importerCv, () => api.importerCv())
  gerer(CANAUX.obtenirProfil, () => api.obtenirProfil())
  gerer(CANAUX.enregistrerProfil, (profil) => api.enregistrerProfil(analyser(entreesIpc.profil, profil)))
  gerer(CANAUX.recupererOffre, (url) => api.recupererOffre(analyser(entreesIpc.url, url)))
  gerer(CANAUX.analyserTexteOffre, (texte) => api.analyserTexteOffre(analyser(entreesIpc.texte, texte)))
  gerer(CANAUX.adapterCv, (offre) => api.adapterCv(analyser(entreesIpc.offre, offre)))
  gerer(CANAUX.lireParametres, () => api.lireParametres())
  gerer(CANAUX.enregistrerParametres, (p) => api.enregistrerParametres(analyser(entreesIpc.parametres, p)))
  gerer(CANAUX.genererAccroche, (profil) => api.genererAccroche(analyser(entreesIpc.profil, profil)))
  gerer(CANAUX.exporterCv, (cv, format, modele) =>
    api.exporterCv(
      analyser(entreesIpc.cv, cv),
      analyser(entreesIpc.format, format),
      modele === undefined ? undefined : analyser(entreesIpc.idModeleCv, modele),
    ),
  )
  gerer(CANAUX.htmlModeleCv, (cv, modele) =>
    api.htmlModeleCv(analyser(entreesIpc.cv, cv), analyser(entreesIpc.idModeleCv, modele)),
  )
  gerer(CANAUX.lireEtatModeles, () => api.lireEtatModeles())
  gerer(CANAUX.telechargerModele, (id) => api.telechargerModele(analyser(entreesIpc.idModele, id)))
  gerer(CANAUX.annulerTelechargement, () => api.annulerTelechargement())
  gerer(CANAUX.supprimerModele, (id) => api.supprimerModele(analyser(entreesIpc.idModele, id)))
  gerer(CANAUX.effacerDonnees, () => api.effacerDonnees())
  gerer(CANAUX.definirCleApi, (cle) => api.definirCleApi(analyser(entreesIpc.cle, cle)))
}
