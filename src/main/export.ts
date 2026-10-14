import { BrowserWindow, dialog } from 'electron'

/** Renders the HTML to an A4 PDF in a hidden window without JavaScript (the text stays real text). */
export async function generatePdf(html: string): Promise<Buffer> {
  const appWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
    },
  })
  try {
    await appWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    // Margins and background (« Bandeau » template) are set by the template CSS (@page).
    // Tagged PDF with an outline: structure (headings, lists) readable by screen readers and recruiting software.
    return await appWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    })
  } finally {
    if (!appWindow.isDestroyed()) appWindow.destroy()
  }
}

export async function chooseDestination(defaultName: string, extension: 'pdf' | 'docx'): Promise<string | null> {
  const options = {
    title: 'Enregistrer le CV',
    defaultPath: defaultName,
    filters: [{ name: extension === 'pdf' ? 'PDF' : 'Document Word', extensions: [extension] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choice = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  return choice.canceled || !choice.filePath ? null : choice.filePath
}
