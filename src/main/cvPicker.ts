import { basename } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { readCv } from './readCv'

/** Native file picker, then text extraction (with the file name). `null` if the user cancels. */
export async function pickAndReadCv(): Promise<{ text: string; name: string } | null> {
  const options = {
    title: 'Importer un CV',
    properties: ['openFile' as const],
    filters: [{ name: 'CV (PDF, DOCX)', extensions: ['pdf', 'docx'] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choice = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const path = choice.filePaths[0]
  if (choice.canceled || !path) return null
  return { text: await readCv(path), name: basename(path) }
}
