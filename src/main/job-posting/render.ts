import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'

/** Chromium User-Agent without the « Electron/… » and « ReCV/… » tokens, which some sites reject. */
export function browserUserAgent(userAgent: string): string {
  return userAgent.replace(/\s(Electron|ReCV)\/\S+/g, '')
}

/**
 * Loads a page in a hidden window (JS runs) and returns its rendered HTML.
 * Isolated window: ephemeral session, sandbox, no nodeIntegration, no preload.
 */
export async function renderHtml(url: string, delayMs = 20_000): Promise<string> {
  const appWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `recv-offre-${randomUUID()}`,
    },
  })
  appWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  appWindow.webContents.setUserAgent(browserUserAgent(appWindow.webContents.getUserAgent()))
  // No WebRTC: useless here, and it reveals the local IP address (STUN requests).
  appWindow.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')

  // Untrusted remote content: no permission, no download, http(s) only.
  const session = appWindow.webContents.session
  session.setPermissionRequestHandler((_contents, _permission, rappel) => rappel(false))
  session.setPermissionCheckHandler(() => false)
  session.on('will-download', (event) => event.preventDefault())
  session.webRequest.onBeforeRequest((request, rappel) => {
    rappel({ cancel: !/^(https?|wss?|data|blob):/i.test(request.url) })
  })
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (!/^https?:/i.test(url)) event.preventDefault()
  })

  const timer = setTimeout(() => {
    if (!appWindow.isDestroyed()) appWindow.destroy()
  }, delayMs)

  try {
    await appWindow.loadURL(url)
    // Gives JS frameworks time to show the content after the initial load.
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    return (await appWindow.webContents.executeJavaScript('document.documentElement.outerHTML')) as string
  } finally {
    clearTimeout(timer)
    if (!appWindow.isDestroyed()) appWindow.destroy()
  }
}
