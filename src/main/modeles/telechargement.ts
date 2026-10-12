import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface OptionsTelechargement {
  url: string
  /** Fichier final ; le téléchargement partiel est écrit dans `<destination>.part`. */
  destination: string
  tailleOctets: number
  sha256: string
  signal?: AbortSignal
  surProgression?: (recuOctets: number, totalOctets: number) => void
  fetchImpl?: typeof fetch
}

export class ErreurTelechargement extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurTelechargement'
  }
}

async function tailleFichier(chemin: string): Promise<number> {
  try {
    return (await stat(chemin)).size
  } catch {
    return 0
  }
}

async function empreinte(chemin: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(chemin), hash)
  return hash.digest('hex')
}

/**
 * Télécharge un fichier volumineux avec reprise (en-tête Range sur le `.part`),
 * puis vérifie sa taille et son SHA-256 avant de le rendre visible sous son nom final.
 */
export async function telechargerFichier(options: OptionsTelechargement): Promise<void> {
  const { url, destination, tailleOctets, sha256, signal, surProgression, fetchImpl = fetch } = options
  const partiel = `${destination}.part`
  await mkdir(dirname(destination), { recursive: true })

  let deja = await tailleFichier(partiel)
  if (deja > tailleOctets) {
    await rm(partiel, { force: true })
    deja = 0
  }

  if (deja < tailleOctets) {
    const reponse = await fetchImpl(url, {
      signal,
      redirect: 'follow',
      headers: deja > 0 ? { Range: `bytes=${deja}-` } : {},
    })
    if (!reponse.ok || !reponse.body) {
      throw new ErreurTelechargement(`Téléchargement impossible (HTTP ${reponse.status}).`)
    }
    // 200 malgré la demande de reprise : le serveur renvoie tout, on repart de zéro.
    if (reponse.status !== 206) deja = 0

    let recu = deja
    surProgression?.(recu, tailleOctets)
    const flux = Readable.fromWeb(reponse.body as Parameters<typeof Readable.fromWeb>[0])
    flux.on('data', (morceau: Buffer) => {
      recu += morceau.length
      surProgression?.(recu, tailleOctets)
    })
    await pipeline(flux, createWriteStream(partiel, { flags: deja > 0 ? 'a' : 'w' }), { signal })
  }

  if ((await tailleFichier(partiel)) !== tailleOctets) {
    await rm(partiel, { force: true })
    throw new ErreurTelechargement('Fichier incomplet ou de taille inattendue : relance le téléchargement.')
  }
  if ((await empreinte(partiel)) !== sha256) {
    await rm(partiel, { force: true })
    throw new ErreurTelechargement('Le fichier téléchargé est corrompu (empreinte SHA-256 différente).')
  }
  await rename(partiel, destination)
}
