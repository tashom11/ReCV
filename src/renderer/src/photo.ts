const COTE_MAX = 360
const TYPES_ACCEPTES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Réduit une photo choisie par l'utilisateur à un carré de 360 px (recadrage centré, sans déformation) en JPEG :
 * quelques dizaines de Ko suffisent pour un CV, et la base reste légère.
 */
export async function reduirePhoto(fichier: File): Promise<string> {
  if (!TYPES_ACCEPTES.includes(fichier.type))
    throw new Error('Format non pris en charge : choisissez une image JPEG, PNG ou WebP.')
  if (fichier.size > 15 * 1024 * 1024) throw new Error('Cette image est trop volumineuse (15 Mo maximum).')

  const bitmap = await createImageBitmap(fichier)
  try {
    const cote = Math.min(bitmap.width, bitmap.height)
    const taille = Math.min(COTE_MAX, cote)
    const canvas = document.createElement('canvas')
    canvas.width = taille
    canvas.height = taille
    const contexte = canvas.getContext('2d')
    if (!contexte) throw new Error('Impossible de traiter cette image.')
    contexte.imageSmoothingQuality = 'high'
    // Fond blanc : un PNG transparent ne doit pas devenir noir en JPEG.
    contexte.fillStyle = '#ffffff'
    contexte.fillRect(0, 0, taille, taille)
    contexte.drawImage(bitmap, (bitmap.width - cote) / 2, (bitmap.height - cote) / 2, cote, cote, 0, 0, taille, taille)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
