import { join } from 'node:path'
import { app, BrowserWindow, shell } from 'electron'

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
  creerFenetre()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
