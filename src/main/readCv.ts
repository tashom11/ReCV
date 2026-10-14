import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { CodedError } from '@core/errors'
import { extractDocxText, extractPdfText } from '@core/parsing'

const MAX_CV_BYTES = 20 * 1024 * 1024
const EXTENSIONS = new Set(['.pdf', '.docx'])

/**
 * Reads a CV (PDF or DOCX) and extracts its text. The path may come from a drop on the window: extension and size are
 * checked here, never assumed.
 */
export async function readCv(path: string): Promise<string> {
  const extension = extname(path).toLowerCase()
  if (!EXTENSIONS.has(extension)) {
    throw new CodedError('fichier-illisible', 'Ce fichier n’est ni un PDF ni un document Word (.docx).')
  }
  let size: number
  try {
    size = (await stat(path)).size
  } catch (error) {
    throw new CodedError('fichier-illisible', 'Fichier introuvable ou inaccessible.', { cause: error })
  }
  if (size > MAX_CV_BYTES) {
    throw new CodedError('fichier-illisible', 'Ce fichier dépasse 20 Mo : ce n’est probablement pas un CV.')
  }

  let text: string
  try {
    const buffer = await readFile(path)
    text = extension === '.docx' ? await extractDocxText(buffer) : await extractPdfText(buffer)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new CodedError('fichier-illisible', `Lecture du fichier impossible : ${detail}`, { cause: error })
  }
  if (!text.trim()) {
    throw new CodedError('fichier-illisible', 'Aucun texte trouvé dans ce fichier (PDF scanné ?).')
  }
  return text
}
