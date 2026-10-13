import { BrowserWindow, dialog } from 'electron'

/** Rend le HTML en PDF A4 dans une fenêtre cachée sans JavaScript (le texte reste du vrai texte). */
export async function genererPdf(html: string): Promise<Buffer> {
  const fenetre = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
    },
  })
  try {
    await fenetre.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    // Marges et fond (modèle « Bandeau ») sont définis par la CSS du modèle (@page).
    return await fenetre.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true })
  } finally {
    if (!fenetre.isDestroyed()) fenetre.destroy()
  }
}

export async function choisirDestination(nomParDefaut: string, extension: 'pdf' | 'docx'): Promise<string | null> {
  const options = {
    title: 'Enregistrer le CV',
    defaultPath: nomParDefaut,
    filters: [{ name: extension === 'pdf' ? 'PDF' : 'Document Word', extensions: [extension] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choix = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  return choix.canceled || !choix.filePath ? null : choix.filePath
}
