import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { extraireTexteDocx, extraireTextePdf } from '@core/parsing'
import { BrowserWindow, dialog } from 'electron'

/** Sélecteur de fichier natif puis extraction du texte. `null` si l'utilisateur annule. */
export async function choisirEtLireCv(): Promise<string | null> {
  const options = {
    title: 'Importer un CV',
    properties: ['openFile' as const],
    filters: [{ name: 'CV (PDF, DOCX)', extensions: ['pdf', 'docx'] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choix = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const chemin = choix.filePaths[0]
  if (choix.canceled || !chemin) return null

  const buffer = await readFile(chemin)
  const texte =
    extname(chemin).toLowerCase() === '.docx' ? await extraireTexteDocx(buffer) : await extraireTextePdf(buffer)
  if (!texte.trim()) throw new Error('Aucun texte trouvé dans ce fichier (PDF scanné ?).')
  return texte
}
