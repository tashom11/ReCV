import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, type IpcResult, isLocalService, settingsSchema } from '@core/api'
import { CodedError } from '@core/errors'
import { type LlmProvider, MockProvider } from '@core/llm'
import { profileSchema } from '@core/schemas'
import type { IpcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db/connection'
import { createProfile, eraseData } from './db/repositories'
import { profiles, tailoredCvs } from './db/schema'
import { registerHandlers } from './ipc'
import { ModelManager } from './models/manager'
import { createService } from './service'
import { type Encryptor, SettingsStore } from './settingsStore'

const encryptor: Encryptor = {
  isAvailable: () => true,
  encrypt: (t) => Buffer.from(t, 'utf8').reverse(),
  decrypt: (b) => Buffer.from(b).reverse().toString('utf8'),
}

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-dur-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

describe('erasing personal data', () => {
  it('leaves no trace of the profile in the database files, journal included', async () => {
    const path = join(folder, 'recv.db')
    const db = openDatabase(path)
    try {
      createProfile(db, profileSchema.parse({ fullName: 'Zoé Trace-Unique', experiences: [] }))
      eraseData(db)
      for (const file of [path, `${path}-wal`]) {
        if (!(await exists(file))) continue
        expect((await readFile(file)).includes('Trace-Unique'), file).toBe(false)
      }
    } finally {
      db.close()
    }
  })
})

describe('service URL validation', () => {
  it('requires https for the API, except for localhost', () => {
    expect(settingsSchema.safeParse({ apiUrl: 'https://api.mistral.ai/v1' }).success).toBe(true)
    expect(settingsSchema.safeParse({ apiUrl: 'http://localhost:8080/v1' }).success).toBe(true)
    expect(settingsSchema.safeParse({ apiUrl: 'http://attaquant.example/v1' }).success).toBe(false)
    expect(settingsSchema.safeParse({ apiUrl: 'ftp://exemple.fr' }).success).toBe(false)
    expect(settingsSchema.safeParse({ apiUrl: 'https://user:mdp@exemple.fr' }).success).toBe(false)
    expect(settingsSchema.safeParse({ ollamaUrl: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('tells whether a service runs on this computer (the CV does not leave it)', () => {
    expect(isLocalService('http://localhost:11434/v1')).toBe(true)
    expect(isLocalService('http://127.0.0.1:11434/v1')).toBe(true)
    expect(isLocalService('http://[::1]:11434/v1')).toBe(true)
    expect(isLocalService('http://192.168.1.20:11434/v1')).toBe(false)
    expect(isLocalService('https://ollama.example.com/v1')).toBe(false)
    expect(isLocalService('pas une url')).toBe(false)
  })

  it('only accepts a .gguf file as local model', () => {
    expect(settingsSchema.safeParse({ localModelPath: 'C:\\modeles\\a.GGUF' }).success).toBe(true)
    expect(settingsSchema.safeParse({ localModelPath: 'C:\\Windows\\system32\\cmd.exe' }).success).toBe(false)
  })
})

describe('API key bound to its destination', () => {
  it('deletes the key when the API origin changes, keeps it otherwise', async () => {
    const store = new SettingsStore(folder, encryptor)
    const base = await store.read()
    await store.save({ ...base, apiUrl: 'https://api.mistral.ai/v1' })
    await store.setKey('sk-secret')

    // Same origin, different path: the key stays.
    const sameOrigin = await store.save({ ...base, apiUrl: 'https://api.mistral.ai/v2' })
    expect(sameOrigin.hasApiKey).toBe(true)

    // Other origin: the key is deleted.
    const other = await store.save({ ...base, apiUrl: 'https://api.openai.com/v1' })
    expect(other.hasApiKey).toBe(false)
    expect(await store.readKey()).toBeNull()
  })
})

describe('service: provider lifecycle and data', () => {
  function create() {
    const db = openDatabase(':memory:')
    const settings = new SettingsStore(folder, encryptor)
    const calls: string[] = []
    let releasedCount = 0
    const service = createService({
      db,
      settings,
      models: new ModelManager({
        folder: join(folder, 'models'),
        resources: async () => ({ ramGb: 8, vramGb: 0 }),
        emit: () => undefined,
      }),
      pickAndReadCv: async () => ({ text: 'cv', name: 'mon-cv.pdf' }),
      updater: {
        state: () => ({ version: '0.0.0', status: 'unavailable' as const }),
        check: async () => ({ version: '0.0.0', status: 'unavailable' as const }),
        install: () => undefined,
      },
      readCv: async () => 'cv',
      openPath: async () => undefined,
      revealPath: () => undefined,
      renderHtml: async () => '',
      chooseDestination: async () => null,
      generatePdf: async () => Buffer.alloc(0),
      createProvider: async (p) => {
        calls.push(p.ollamaModel)
        const mock = new MockProvider()
        const provider: LlmProvider = {
          extractProfile: (t) => mock.extractProfile(t),
          extractJobPosting: (t) => mock.extractJobPosting(t),
          analyzeJobPosting: (o) => mock.analyzeJobPosting(o),
          tailorCv: (pr, o) => mock.tailorCv(pr, o),
          generateSummary: (pr) => mock.generateSummary(pr),
          release: async () => void releasedCount++,
        }
        return provider
      },
    })
    return { service, settings, db, calls, releasedCount: () => releasedCount }
  }

  it('reuses the provider as long as the settings do not change, then releases it', async () => {
    const { service, settings, calls, releasedCount } = create()
    await service.importCv()
    await service.parseJobPostingText('offre')
    await service.parseJobPostingText('offre')
    expect(calls).toHaveLength(1)

    await settings.save({ ...(await settings.read()), ollamaModel: 'autre-modele' })
    await service.parseJobPostingText('offre')
    expect(calls).toEqual(['qwen3:8b', 'autre-modele'])
    expect(releasedCount()).toBe(1)

    await service.release()
    expect(releasedCount()).toBe(2)
  })

  it('importing a CV creates a new active profile and deletes the unused previous one', async () => {
    const { service, db } = create()
    const first = await service.importCv()
    const second = await service.importCv()
    expect(second?.id).not.toBe(first?.id)
    expect((await service.getProfile())?.id).toBe(second?.id)
    expect(
      db
        .select()
        .from(profiles)
        .all()
        .map((p) => p.id),
    ).toEqual([second?.id])
  })

  it('keeps no more than 20 tailored CVs', async () => {
    const { service, db } = create()
    await service.importCv()
    for (let i = 0; i < 22; i++) await service.tailorCv({ jobTitle: `Poste ${i}`, rawText: 'x' })
    expect(db.select().from(tailoredCvs).all()).toHaveLength(20)
  })

  it('erases profiles, job postings, CVs and API key', async () => {
    const { service, settings } = create()
    await service.importCv()
    await service.tailorCv({ jobTitle: 'Dev', rawText: 'x' })
    await service.setApiKey('sk-abc')

    await service.eraseData()
    expect(await service.getProfile()).toBeNull()
    expect(await settings.readKey()).toBeNull()
    expect(await exists(join(folder, 'api-key.bin'))).toBe(false)
  })
})

describe('handlers IPC', () => {
  type Handler = (event: { senderFrame?: { url: string } }, ...args: unknown[]) => Promise<IpcResult<unknown>>

  function wire(allowed: (url: string) => boolean) {
    const handlers = new Map<string, Handler>()
    const ipcMain = { handle: (channel: string, h: Handler) => void handlers.set(channel, h) } as unknown as IpcMain
    const calledMethods: string[] = []
    const api = new Proxy(
      {},
      {
        get:
          (_target, name) =>
          async (...args: unknown[]) => {
            calledMethods.push(`${String(name)}:${JSON.stringify(args)}`)
            return null
          },
      },
    )
    registerHandlers(ipcMain, api as never, allowed)
    return { handlers, calledMethods }
  }

  it('refuses a call whose frame is not the application interface', async () => {
    const { handlers, calledMethods } = wire((url) => url.startsWith('file://'))
    const h = handlers.get(CHANNELS.getProfile)
    const refused = await h?.({ senderFrame: { url: 'https://evil.example/' } })
    expect(refused).toMatchObject({ ok: false, message: 'Appel IPC refusé.' })
    expect(calledMethods).toHaveLength(0)

    const accepted = await h?.({ senderFrame: { url: 'file:///app/index.html' } })
    expect(accepted).toEqual({ ok: true, value: null })
  })

  it('refuses invalid settings before calling the service', async () => {
    const { handlers, calledMethods } = wire(() => true)
    const result = await handlers.get(CHANNELS.saveSettings)?.({}, { apiUrl: 'http://attaquant.example' })
    expect(result?.ok).toBe(false)
    expect(calledMethods).toHaveLength(0)
  })

  it('passes on the error code the interface tells apart', async () => {
    const handlers = new Map<string, Handler>()
    const ipcMain = { handle: (channel: string, h: Handler) => void handlers.set(channel, h) } as unknown as IpcMain
    const api = {
      cancelTailoring: async () => {
        throw new CodedError('cancelled', 'Création annulée.')
      },
    }
    registerHandlers(ipcMain, api as never)
    expect(await handlers.get(CHANNELS.cancelTailoring)?.({})).toEqual({
      ok: false,
      message: 'Création annulée.',
      code: 'cancelled',
    })
  })

  it('refuses an empty or oversized file path', async () => {
    const { handlers, calledMethods } = wire(() => true)
    expect((await handlers.get(CHANNELS.openFile)?.({}, ''))?.ok).toBe(false)
    expect((await handlers.get(CHANNELS.importDroppedCv)?.({}, 'x'.repeat(5_000)))?.ok).toBe(false)
    expect((await handlers.get(CHANNELS.revealInFolder)?.({}, { path: 'objet' }))?.ok).toBe(false)
    expect(calledMethods).toHaveLength(0)
  })

  it('refuses an oversized profile', async () => {
    const { handlers, calledMethods } = wire(() => true)
    const huge = { skills: Array.from({ length: 20_000 }, (_, i) => `compétence numéro ${i} ${'x'.repeat(20)}`) }
    const result = await handlers.get(CHANNELS.saveProfile)?.({}, huge)
    expect(result?.ok).toBe(false)
    expect(calledMethods).toHaveLength(0)
  })
})
