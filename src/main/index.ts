import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CHANNELS } from '@core/channels'
import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, session, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { APP_ENTRY_URL, APP_SCHEME, isAppUrl, resolveAppFile } from './appProtocol'
import { openDatabaseSafely } from './bdd/connexion'
import { DatabaseTooNewError } from './bdd/migrations'
import { choisirEtLireCv } from './cv'
import { choisirDestination, genererPdf } from './export'
import { enregistrerHandlers } from './ipc'
import { lireCv } from './lectureCv'
import { GestionnaireMiseAJour } from './miseAJour'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { detecterRessources } from './modeles/ressources'
import { rendreHtml, userAgentNavigateur } from './offre/rendu'
import { StockageParametres } from './parametres'
import { creerService } from './service'
import { settleWithin } from './timeout'

const URL_DEV = process.env.ELECTRON_RENDERER_URL
// Freeing the local model must not keep the app open forever.
const DELAI_LIBERATION_MS = 5_000
const DOSSIER_RENDERER = join(__dirname, '../renderer')

// Seule l'interface de l'application peut appeler l'IPC (dev : serveur Vite ; installée : app://recv/).
function expediteurAutorise(url: string): boolean {
  return isAppUrl(url, !app.isPackaged ? URL_DEV : undefined)
}

// Must happen before `ready`: a standard, secure scheme behaves like https (same-origin rules, ES modules, CSP 'self').
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Icône de la fenêtre : en application installée, elle vient de l'exécutable (build/icon.ico) ; ce PNG sert
// au mode développement, où l'exécutable est celui d'Electron.
const CHEMIN_ICONE = join(__dirname, '../../build/icon.png')

function creerFenetre(): void {
  const fenetre = new BrowserWindow({
    ...(existsSync(CHEMIN_ICONE) ? { icon: CHEMIN_ICONE } : {}),
    width: 1200,
    height: 800,
    show: false,
    title: 'Re:CV',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  fenetre.on('ready-to-show', () => fenetre.show())

  // L'interface ne quitte jamais ses propres pages (lien, fichier HTML déposé sur la fenêtre…) ; se recharger reste
  // possible (rechargement de Vite en développement).
  fenetre.webContents.on('will-navigate', (evenement, url) => {
    if (!expediteurAutorise(url)) evenement.preventDefault()
  })
  fenetre.webContents.on('will-attach-webview', (evenement) => evenement.preventDefault())

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && URL_DEV) {
    void fenetre.loadURL(URL_DEV)
  } else {
    void fenetre.loadURL(APP_ENTRY_URL)
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('org.recv.app')
  // Electron accorde les permissions (caméra, micro, géolocalisation…) par défaut : l'app n'en a besoin d'aucune.
  session.defaultSession.setPermissionRequestHandler((_contenu, _permission, rappel) => rappel(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  protocol.handle(APP_SCHEME, (requete) => {
    const fichier = resolveAppFile(requete.url, DOSSIER_RENDERER)
    return fichier ? net.fetch(pathToFileURL(fichier).toString()) : new Response('Not found', { status: 404 })
  })
  const donnees = app.getPath('userData')
  let ouverture: ReturnType<typeof openDatabaseSafely>
  try {
    ouverture = openDatabaseSafely(join(donnees, 'recv.db'))
  } catch (erreur) {
    // Say why rather than leave a blank window: data from a newer Re:CV, or a data folder not writable.
    dialog.showErrorBox(
      'Re:CV ne peut pas démarrer',
      erreur instanceof DatabaseTooNewError
        ? 'Vos données ont été enregistrées par une version plus récente de Re:CV. Installez la dernière version ' +
            'depuis le site du projet : vos données sont intactes.'
        : `Le dossier de données de Re:CV est inaccessible :\n${donnees}\n\n${erreur instanceof Error ? erreur.message : String(erreur)}`,
    )
    app.exit(1)
    return
  }
  const { bdd, backupPath } = ouverture
  const parametres = new StockageParametres(donnees, {
    disponible: () => safeStorage.isEncryptionAvailable(),
    chiffrer: (texte) => safeStorage.encryptString(texte),
    dechiffrer: (buffer) => safeStorage.decryptString(buffer),
  })
  const modeles = new GestionnaireModeles({
    dossier: join(donnees, 'modeles'),
    ressources: detecterRessources,
    emettre: (progression) => {
      for (const fenetre of BrowserWindow.getAllWindows()) {
        fenetre.webContents.send(CHANNELS.modelProgress, progression)
      }
    },
    // Le modèle téléchargé devient le modèle local actif.
    apresInstallation: async (chemin) => {
      await parametres.enregistrer({ ...(await parametres.lire()), localModelPath: chemin })
    },
  })
  // Mises à jour (releases GitHub) : uniquement dans l'application installée.
  const misesAJour = new GestionnaireMiseAJour({
    version: app.getVersion(),
    installee: app.isPackaged,
    moteur: () => autoUpdater,
    emettre: (etat) => {
      for (const fenetre of BrowserWindow.getAllWindows()) {
        fenetre.webContents.send(CHANNELS.updateStatus, etat)
      }
    },
  })
  const service = creerService({
    bdd,
    parametres,
    modeles,
    misesAJour,
    emettreTache: (progression) => {
      for (const fenetre of BrowserWindow.getAllWindows()) {
        fenetre.webContents.send(CHANNELS.taskProgress, progression)
      }
    },
    choisirEtLireCv,
    lireCv,
    ouvrirChemin: async (chemin) => {
      const echec = await shell.openPath(chemin)
      if (echec) throw new Error(echec)
    },
    montrerChemin: (chemin) => shell.showItemInFolder(chemin),
    rendreHtml,
    userAgent: userAgentNavigateur(session.defaultSession.getUserAgent()),
    choisirDestination,
    genererPdf,
  })
  enregistrerHandlers(ipcMain, service, expediteurAutorise)

  // Libère proprement le modèle local (mémoire native) avant de quitter.
  let liberation = false
  app.on('before-quit', (evenement) => {
    if (liberation) return
    evenement.preventDefault()
    liberation = true
    void settleWithin(service.liberer(), DELAI_LIBERATION_MS).then(() => app.quit())
  })

  creerFenetre()
  if (backupPath) {
    void dialog.showMessageBox({
      type: 'warning',
      title: 'Re:CV',
      message: 'Vos données enregistrées n’ont pas pu être lues',
      detail:
        `Le fichier était abîmé. Re:CV repart de zéro : il faudra importer à nouveau votre CV.\n\n` +
        `Une copie du fichier abîmé est gardée ici :\n${backupPath}`,
    })
  }
  misesAJour.demarrer()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
