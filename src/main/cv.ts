import { basename } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { lireCv } from './lectureCv'

/** Sélecteur de fichier natif puis extraction du texte (avec le nom du fichier). `null` si l'utilisateur annule. */
export async function choisirEtLireCv(): Promise<{ texte: string; nom: string } | null> {
  const options = {
    title: 'Importer un CV',
    properties: ['openFile' as const],
    filters: [{ name: 'CV (PDF, DOCX)', extensions: ['pdf', 'docx'] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choix = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const chemin = choix.filePaths[0]
  if (choix.canceled || !chemin) return null
  return { texte: await lireCv(chemin), nom: basename(chemin) }
}
