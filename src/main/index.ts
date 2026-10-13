import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CANAUX } from '@core/canaux'
import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from 'electron'
import { ouvrirBdd } from './bdd/connexion'
import { choisirEtLireCv } from './cv'
import { choisirDestination, genererPdf } from './export'
import { enregistrerHandlers } from './ipc'
import { verifierMisesAJour } from './miseAJour'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { detecterRessources } from './modeles/ressources'
import { rendreHtml, userAgentNavigateur } from './offre/rendu'
import { StockageParametres } from './parametres'
import { creerService } from './service'

const URL_DEV = process.env.ELECTRON_RENDERER_URL

// Seule l'interface de l'application peut appeler l'IPC (dev : serveur Vite ; installée : fichier local).
function expediteurAutorise(url: string): boolean {
  if (!app.isPackaged && URL_DEV) return url.startsWith(new URL(URL_DEV).origin)
  return url.startsWith('file://')
}

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

  // L'interface ne navigue jamais ailleurs que sur elle-même.
  fenetre.webContents.on('will-navigate', (evenement, url) => {
    if (!expediteurAutorise(url)) evenement.preventDefault()
  })

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && URL_DEV) {
    void fenetre.loadURL(URL_DEV)
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('org.recv.app')
  // Electron accorde les permissions (caméra, micro, géolocalisation…) par défaut : l'app n'en a besoin d'aucune.
  session.defaultSession.setPermissionRequestHandler((_contenu, _permission, rappel) => rappel(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  const donnees = app.getPath('userData')
  const bdd = ouvrirBdd(join(donnees, 'recv.db'))
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
        fenetre.webContents.send(CANAUX.progressionModele, progression)
      }
    },
    // Le modèle téléchargé devient le modèle local actif.
    apresInstallation: async (chemin) => {
      await parametres.enregistrer({ ...(await parametres.lire()), cheminModeleLocal: chemin })
    },
  })
  const service = creerService({
    bdd,
    parametres,
    modeles,
    emettreTache: (progression) => {
      for (const fenetre of BrowserWindow.getAllWindows()) {
        fenetre.webContents.send(CANAUX.progressionTache, progression)
      }
    },
    choisirEtLireCv,
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
    void service.liberer().finally(() => app.quit())
  })

  creerFenetre()
  verifierMisesAJour()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
