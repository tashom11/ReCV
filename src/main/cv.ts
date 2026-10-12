import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { extraireTexteDocx, extraireTextePdf } from '@core/parsing'
import { BrowserWindow, dialog } from 'electron'

const TAILLE_MAX_CV_OCTETS = 20 * 1024 * 1024

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

  if ((await stat(chemin)).size > TAILLE_MAX_CV_OCTETS) {
    throw new Error('Ce fichier dépasse 20 Mo : ce n’est probablement pas un CV.')
  }
  const buffer = await readFile(chemin)
  const texte =
    extname(chemin).toLowerCase() === '.docx' ? await extraireTexteDocx(buffer) : await extraireTextePdf(buffer)
  if (!texte.trim()) throw new Error('Aucun texte trouvé dans ce fichier (PDF scanné ?).')
  return texte
}
