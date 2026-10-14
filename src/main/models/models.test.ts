import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ModelDownloadProgress } from '@core/api'
import { LOCAL_MODELS, recommendModel } from '@core/llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { downloadFile } from './download'
import { ModelManager } from './manager'

describe('proposerModele', () => {
  it('picks the largest model supported by the RAM or the VRAM', () => {
    expect(recommendModel({ ramGb: 4, vramGb: 0 }).id).toBe('qwen3.5-2b')
    expect(recommendModel({ ramGb: 8, vramGb: 0 }).id).toBe('qwen3.5-4b')
    // The 9B is only recommended with a real graphics card (≥ 10 GB): on CPU it is too slow.
    expect(recommendModel({ ramGb: 32, vramGb: 0 }).id).toBe('qwen3.5-4b')
    expect(recommendModel({ ramGb: 32, vramGb: 8 }).id).toBe('qwen3.5-4b')
    expect(recommendModel({ ramGb: 32, vramGb: 12 }).id).toBe('qwen3.5-9b')
  })

  it('falls back to the smallest one if the computer is below every threshold', () => {
    expect(recommendModel({ ramGb: 2, vramGb: 0 }).id).toBe('qwen3.5-2b')
  })

  it('lists valid Hugging Face URLs and SHA-256 digests', () => {
    for (const m of LOCAL_MODELS) {
      expect(m.url).toMatch(/^https:\/\/huggingface\.co\/.+\.gguf$/)
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('telechargerFichier', () => {
  const content = Buffer.from(`${'x'.repeat(10_000)}fin du modèle`)
  const sha256 = createHash('sha256').update(content).digest('hex')
  let server: Server
  let url: string
  let folder: string
  let rangeRequests: (string | undefined)[]

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'recv-dl-'))
    rangeRequests = []
    server = createServer((req, res) => {
      rangeRequests.push(req.headers.range)
      const start = req.headers.range ? Number(/bytes=(\d+)-/.exec(req.headers.range)?.[1]) : 0
      res.statusCode = start > 0 ? 206 : 200
      res.setHeader('content-length', content.length - start)
      res.end(content.subarray(start))
    })
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/m.gguf`
  })
  afterEach(async () => {
    server.close()
    await rm(folder, { recursive: true, force: true })
  })

  it('downloads, verifies the digest and renames the file', async () => {
    const destination = join(folder, 'm.gguf')
    const progressUpdates: number[] = []
    await downloadFile({
      url,
      destination,
      sizeBytes: content.length,
      sha256,
      onProgress: (received) => progressUpdates.push(received),
    })
    expect(await readFile(destination)).toEqual(content)
    expect(progressUpdates.at(-1)).toBe(content.length)
    await expect(stat(`${destination}.part`)).rejects.toThrow()
  })

  it('resumes a partial download with a Range header', async () => {
    const destination = join(folder, 'm.gguf')
    await writeFile(`${destination}.part`, content.subarray(0, 4_000))
    await downloadFile({ url, destination, sizeBytes: content.length, sha256 })
    expect(rangeRequests).toEqual(['bytes=4000-'])
    expect(await readFile(destination)).toEqual(content)
  })

  it('rejects a corrupted file and deletes the partial one', async () => {
    const destination = join(folder, 'm.gguf')
    await expect(downloadFile({ url, destination, sizeBytes: content.length, sha256: '0'.repeat(64) })).rejects.toThrow(
      /corrompu/,
    )
    await expect(stat(destination)).rejects.toThrow()
    await expect(stat(`${destination}.part`)).rejects.toThrow()
  })
})

describe('GestionnaireModeles', () => {
  let folder: string
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'recv-gm-'))
  })
  afterEach(async () => {
    await rm(folder, { recursive: true, force: true })
  })

  it('recommends a model, installs then deletes it', async () => {
    const events: ModelDownloadProgress[] = []
    const installedModels: string[] = []
    const manager = new ModelManager({
      folder,
      resources: async () => ({ ramGb: 8, vramGb: 0 }),
      emit: (p) => events.push(p),
      afterInstall: async (path) => void installedModels.push(path),
      download: async ({ destination, sizeBytes, onProgress }) => {
        // Sparse file: no real multi-GB writes.
        await writeFile(destination, '')
        await truncate(destination, sizeBytes)
        onProgress?.(sizeBytes, sizeBytes)
      },
    })

    const before = await manager.state()
    expect(before.models.find((m) => m.recommended)?.id).toBe('qwen3.5-4b')
    expect(before.models.every((m) => !m.installed)).toBe(true)

    await manager.download('qwen3.5-4b')
    expect(installedModels).toHaveLength(1)
    expect(events.at(-1)?.status).toBe('done')
    expect((await manager.state()).models.find((m) => m.id === 'qwen3.5-4b')?.installed).toBe(true)

    await manager.remove('qwen3.5-4b')
    expect((await manager.state()).models.every((m) => !m.installed)).toBe(true)
  })

  it('refuses an unknown id and two simultaneous downloads', async () => {
    let unblock: () => void = () => undefined
    const manager = new ModelManager({
      folder,
      resources: async () => ({ ramGb: 8, vramGb: 0 }),
      emit: () => undefined,
      download: () => new Promise<void>((ok) => (unblock = ok)),
    })
    await expect(manager.download('inconnu')).rejects.toThrow(/inconnu/)
    const first = manager.download('qwen3.5-2b')
    await expect(manager.download('qwen3.5-4b')).rejects.toThrow(/déjà en cours/)
    unblock()
    await first
  })
})
