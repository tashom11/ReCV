import { BrowserWindow } from 'electron'

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
      partition: `recv-offre-${Date.now()}`,
    },
  })
  fenetre.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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
