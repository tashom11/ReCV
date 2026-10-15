import { existsSync } from 'node:fs'
import { release } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CHANNELS } from '@core/channels'
import { errorEntry } from '@core/diagnostics'
import { app, BrowserWindow, clipboard, dialog, ipcMain, net, protocol, safeStorage, session, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { APP_ENTRY_URL, APP_SCHEME, isAppUrl, resolveAppFile } from './appProtocol'
import { pickAndReadCv } from './cvPicker'
import { DATA_FILES, migrateDataFolder } from './dataFolder'
import { openDatabaseSafely } from './db/connection'
import { DatabaseTooNewError } from './db/migrations'
import { DiagnosticLog } from './diagnosticLog'
import { chooseDestination, generatePdf } from './export'
import { registerHandlers } from './ipc'
import { browserUserAgent, renderHtml } from './job-posting/render'
import { ModelManager } from './models/manager'
import { pickModelFile } from './models/modelPicker'
import { detectResources } from './models/resources'
import { readCv } from './readCv'
import { createService } from './service'
import { SettingsStore } from './settingsStore'
import { settleWithin } from './timeout'
import { Updater } from './updater'

const DEV_URL = process.env.ELECTRON_RENDERER_URL
// Freeing the local model must not keep the app open forever.
const RELEASE_TIMEOUT_MS = 5_000
const RENDERER_DIR = join(__dirname, '../renderer')

// Only the application interface may call the IPC (dev: Vite server; installed: app://recv/).
function isAllowedSender(url: string): boolean {
  return isAppUrl(url, !app.isPackaged ? DEV_URL : undefined)
}

// Must happen before `ready`: a standard, secure scheme behaves like https (same-origin rules, ES modules, CSP 'self').
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Window icon: in the installed application, it comes from the executable (build/icon.ico); this PNG is for development
// mode, where the executable is Electron's.
const ICON_PATH = join(__dirname, '../../build/icon.png')

function createWindow(): void {
  const appWindow = new BrowserWindow({
    ...(existsSync(ICON_PATH) ? { icon: ICON_PATH } : {}),
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

  appWindow.on('ready-to-show', () => appWindow.show())

  // The interface never leaves its own pages (link, HTML file dropped on the window…); reloading stays possible (Vite
  // reload in development).
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedSender(url)) event.preventDefault()
  })
  appWindow.webContents.on('will-attach-webview', (event) => event.preventDefault())

  // External links open in the browser, never in the app.
  appWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && DEV_URL) {
    void appWindow.loadURL(DEV_URL)
  } else {
    void appWindow.loadURL(APP_ENTRY_URL)
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('org.recv.app')
  // Electron grants permissions (camera, microphone, geolocation…) by default: the app needs none of them.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  protocol.handle(APP_SCHEME, (request) => {
    const file = resolveAppFile(request.url, RENDERER_DIR)
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response('Not found', { status: 404 })
  })
  const data = app.getPath('userData')
  let opening: ReturnType<typeof openDatabaseSafely>
  try {
    // v0.2.1 data files get their English names first (settings, API key, models folder).
    await migrateDataFolder(data)
    opening = openDatabaseSafely(join(data, DATA_FILES.database))
  } catch (error) {
    // Say why rather than leave a blank window: data from a newer Re:CV, or a data folder not writable.
    dialog.showErrorBox(
      'Re:CV ne peut pas démarrer',
      error instanceof DatabaseTooNewError
        ? 'Vos données ont été enregistrées par une version plus récente de Re:CV. Installez la dernière version ' +
            'depuis le site du projet : vos données sont intactes.'
        : `Le dossier de données de Re:CV est inaccessible :\n${data}\n\n${error instanceof Error ? error.message : String(error)}`,
    )
    app.exit(1)
    return
  }
  const { db, backupPath } = opening
  // Local diagnostic log: error codes only, never a message nor CV data. Copied by the user from the settings.
  const log = new DiagnosticLog(join(data, 'logs'))
  log.append({ at: new Date().toISOString(), kind: 'start', version: app.getVersion() })
  app.on('render-process-gone', (_event, _contents, details) => {
    log.append({ at: new Date().toISOString(), kind: 'crash', reason: details.reason })
  })
  const settings = new SettingsStore(data, {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (text) => safeStorage.encryptString(text),
    decrypt: (buffer) => safeStorage.decryptString(buffer),
  })
  const models = new ModelManager({
    folder: join(data, DATA_FILES.models),
    resources: detectResources,
    emit: (progress) => {
      for (const appWindow of BrowserWindow.getAllWindows()) {
        appWindow.webContents.send(CHANNELS.modelProgress, progress)
      }
    },
    // The downloaded model becomes the active local model.
    afterInstall: async (path) => {
      await settings.save({ ...(await settings.read()), localModelPath: path })
    },
  })
  // Updates (GitHub releases): only in the installed application.
  const updater = new Updater({
    version: app.getVersion(),
    installed: app.isPackaged,
    engine: () => autoUpdater,
    emit: (state) => {
      for (const appWindow of BrowserWindow.getAllWindows()) {
        appWindow.webContents.send(CHANNELS.updateStatus, state)
      }
    },
  })
  const service = createService({
    db,
    settings,
    models,
    updater,
    emitTask: (progress) => {
      for (const appWindow of BrowserWindow.getAllWindows()) {
        appWindow.webContents.send(CHANNELS.taskProgress, progress)
      }
    },
    pickAndReadCv,
    readCv,
    openPath: async (path) => {
      const failure = await shell.openPath(path)
      if (failure) throw new Error(failure)
    },
    revealPath: (path) => shell.showItemInFolder(path),
    renderHtml,
    userAgent: browserUserAgent(session.defaultSession.getUserAgent()),
    chooseDestination,
    generatePdf,
    pickModelFile,
    diagnostics: {
      version: app.getVersion(),
      os: `Windows ${release()}`,
      recentLines: (count) => log.recent(count),
      copy: (text) => clipboard.writeText(text),
    },
  })
  registerHandlers(ipcMain, service, isAllowedSender, (channel, error) => log.append(errorEntry(channel, error)))

  // Cleanly frees the local model (native memory) before quitting.
  let releasing = false
  app.on('before-quit', (event) => {
    if (releasing) return
    event.preventDefault()
    releasing = true
    void settleWithin(service.release(), RELEASE_TIMEOUT_MS).then(() => app.quit())
  })

  createWindow()
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
  updater.start()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
