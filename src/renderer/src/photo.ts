const MAX_SIDE = 360
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Reduces a photo chosen by the user to a 360 px square (centred crop, no distortion) in JPEG: a few dozen KB are
 * enough for a CV, and the database stays light.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type))
    throw new Error('Format non pris en charge : choisissez une image JPEG, PNG ou WebP.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Cette image est trop volumineuse (15 Mo maximum).')

  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const size = Math.min(MAX_SIDE, side)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Impossible de traiter cette image.')
    context.imageSmoothingQuality = 'high'
    // White background: a transparent PNG must not turn black in JPEG.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size, size)
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
