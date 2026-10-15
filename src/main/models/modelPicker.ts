import { BrowserWindow, dialog } from 'electron'

/** Native file picker for a local model (.gguf). `null` if the user cancels. */
export async function pickModelFile(): Promise<string | null> {
  const options = {
    title: 'Choisir un modèle (.gguf)',
    properties: ['openFile' as const],
    filters: [{ name: 'Modèle GGUF', extensions: ['gguf'] }],
  }
  const parent = BrowserWindow.getFocusedWindow()
  const choice = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const path = choice.filePaths[0]
  return choice.canceled || !path ? null : path
}
