import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface DownloadOptions {
  url: string
  /** Final file; the partial download is written to `<destination>.part`. */
  destination: string
  sizeBytes: number
  sha256: string
  signal?: AbortSignal
  onProgress?: (receivedBytes: number, totalOctets: number) => void
  fetchImpl?: typeof fetch
}

export class DownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurTelechargement'
  }
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size
  } catch {
    return 0
  }
}

async function fingerprint(path: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

/**
 * Downloads a large file with resume (Range header on the `.part`), then checks its size and SHA-256 before making it
 * visible under its final name.
 */
export async function downloadFile(options: DownloadOptions): Promise<void> {
  const { url, destination, sizeBytes, sha256, signal, onProgress, fetchImpl = fetch } = options
  const partial = `${destination}.part`
  await mkdir(dirname(destination), { recursive: true })

  let already = await fileSize(partial)
  if (already > sizeBytes) {
    await rm(partial, { force: true })
    already = 0
  }

  if (already < sizeBytes) {
    const response = await fetchImpl(url, {
      signal,
      redirect: 'follow',
      headers: already > 0 ? { Range: `bytes=${already}-` } : {},
    })
    if (!response.ok || !response.body) {
      throw new DownloadError(`Téléchargement impossible (HTTP ${response.status}).`)
    }
    // 200 despite the resume request: the server sends everything, start again from zero.
    if (response.status !== 206) already = 0

    let received = already
    onProgress?.(received, sizeBytes)
    const stream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
    stream.on('data', (chunk: Buffer) => {
      received += chunk.length
      onProgress?.(received, sizeBytes)
    })
    await pipeline(stream, createWriteStream(partial, { flags: already > 0 ? 'a' : 'w' }), { signal })
  }

  if ((await fileSize(partial)) !== sizeBytes) {
    await rm(partial, { force: true })
    throw new DownloadError('Fichier incomplet ou de taille inattendue : relancez le téléchargement.')
  }
  if ((await fingerprint(partial)) !== sha256) {
    await rm(partial, { force: true })
    throw new DownloadError('Le fichier téléchargé est corrompu (empreinte SHA-256 différente).')
  }
  await rename(partial, destination)
}
