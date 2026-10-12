import { join } from 'node:path'
import { CANAUX } from '@core/canaux'
import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { ouvrirBdd } from './bdd/connexion'
import { choisirEtLireCv } from './cv'
import { choisirDestination, genererPdf } from './export'
import { enregistrerHandlers } from './ipc'
import { GestionnaireModeles } from './modeles/gestionnaire'
import { detecterRessources } from './modeles/ressources'
import { rendreHtml } from './offre/rendu'
import { StockageParametres } from './parametres'
import { creerService } from './service'

function creerFenetre(): void {
  const fenetre = new BrowserWindow({
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

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'app.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const urlDev = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && urlDev) {
    void fenetre.loadURL(urlDev)
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('org.recv.app')
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
  enregistrerHandlers(
    ipcMain,
    creerService({ bdd, parametres, modeles, choisirEtLireCv, rendreHtml, choisirDestination, genererPdf }),
  )

  creerFenetre()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
