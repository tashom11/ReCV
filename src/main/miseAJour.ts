import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Vérifie les mises à jour au démarrage (releases GitHub), uniquement dans l'application installée.
 * Silencieux en cas d'échec (hors ligne, dépôt privé…) : une mise à jour ne doit jamais gêner l'usage.
 */
export function verifierMisesAJour(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', () => undefined)
  autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
}
