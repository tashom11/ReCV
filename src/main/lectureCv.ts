import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { CodedError } from '@core/errors'
import { extractDocxText, extractPdfText } from '@core/parsing'

const TAILLE_MAX_CV_OCTETS = 20 * 1024 * 1024
const EXTENSIONS = new Set(['.pdf', '.docx'])

/**
 * Lit un CV (PDF ou DOCX) et en extrait le texte. Le chemin peut venir d'un dépôt dans la fenêtre :
 * extension et taille sont vérifiées ici, jamais supposées.
 */
export async function lireCv(chemin: string): Promise<string> {
  const extension = extname(chemin).toLowerCase()
  if (!EXTENSIONS.has(extension)) {
    throw new CodedError('fichier-illisible', 'Ce fichier n’est ni un PDF ni un document Word (.docx).')
  }
  let taille: number
  try {
    taille = (await stat(chemin)).size
  } catch (erreur) {
    throw new CodedError('fichier-illisible', 'Fichier introuvable ou inaccessible.', { cause: erreur })
  }
  if (taille > TAILLE_MAX_CV_OCTETS) {
    throw new CodedError('fichier-illisible', 'Ce fichier dépasse 20 Mo : ce n’est probablement pas un CV.')
  }

  let texte: string
  try {
    const buffer = await readFile(chemin)
    texte = extension === '.docx' ? await extractDocxText(buffer) : await extractPdfText(buffer)
  } catch (erreur) {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)
    throw new CodedError('fichier-illisible', `Lecture du fichier impossible : ${detail}`, { cause: erreur })
  }
  if (!texte.trim()) {
    throw new CodedError('fichier-illisible', 'Aucun texte trouvé dans ce fichier (PDF scanné ?).')
  }
  return texte
}
