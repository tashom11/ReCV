import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'

/** User-Agent Chromium sans les jetons « Electron/… » et « ReCV/… », que certains sites rejettent. */
export function userAgentNavigateur(userAgent: string): string {
  return userAgent.replace(/\s(Electron|ReCV)\/\S+/g, '')
}

/**
 * Charge une page dans une fenêtre cachée (JS exécuté) et retourne son HTML rendu.
 * Fenêtre isolée : session éphémère, sandbox, pas de nodeIntegration, pas de preload.
 */
export async function rendreHtml(url: string, delaiMs = 20_000): Promise<string> {
  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: `recv-offre-${randomUUID()}`,
    },
  })
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  fenetre.webContents.setUserAgent(userAgentNavigateur(fenetre.webContents.getUserAgent()))
  // Pas de WebRTC : inutile ici, et il révèle l'adresse IP locale (requêtes STUN).
  fenetre.webContents.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')

  // Contenu distant non fiable : aucune permission, aucun téléchargement, uniquement http(s).
  const session = fenetre.webContents.session
  session.setPermissionRequestHandler((_contenu, _permission, rappel) => rappel(false))
  session.setPermissionCheckHandler(() => false)
  session.on('will-download', (evenement) => evenement.preventDefault())
  session.webRequest.onBeforeRequest((requete, rappel) => {
    rappel({ cancel: !/^(https?|wss?|data|blob):/i.test(requete.url) })
  })
  fenetre.webContents.on('will-navigate', (evenement, url) => {
    if (!/^https?:/i.test(url)) evenement.preventDefault()
  })

  const minuteur = setTimeout(() => {
    if (!fenetre.isDestroyed()) fenetre.destroy()
  }, delaiMs)

  try {
    await fenetre.loadURL(url)
    // Laisse le temps aux frameworks JS d'afficher le contenu après le chargement initial.
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    return (await fenetre.webContents.executeJavaScript('document.documentElement.outerHTML')) as string
  } finally {
    clearTimeout(minuteur)
    if (!fenetre.isDestroyed()) fenetre.destroy()
  }
}
