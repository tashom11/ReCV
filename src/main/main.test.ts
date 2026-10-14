import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Settings } from '@core/api'
import { cannedProfile, type LlmProvider, MockProvider } from '@core/llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db/connection'
import { getActiveProfile, saveProfile } from './db/repositories'
import { ModelManager } from './models/manager'
import { readCv } from './readCv'
import { createService } from './service'
import { type Encryptor, SettingsStore } from './settingsStore'

// Fake encryptor: reverses the bytes (enough to check that nothing is written in clear).
const fakeEncryptor = (isAvailable = true): Encryptor => ({
  isAvailable: () => isAvailable,
  encrypt: (t) => Buffer.from(t, 'utf8').reverse(),
  decrypt: (b) => Buffer.from(b).reverse().toString('utf8'),
})

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-test-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

describe('BDD', () => {
  it('saves then updates the active profile', () => {
    const db = openDatabase(':memory:')
    expect(getActiveProfile(db)).toBeNull()
    const first = saveProfile(db, cannedProfile)
    const second = saveProfile(db, { ...cannedProfile, fullName: 'Autre' })
    expect(second.id).toBe(first.id)
    expect(getActiveProfile(db)?.profile.fullName).toBe('Autre')
    db.close()
  })
})

describe('StockageParametres', () => {
  it('encrypts the API key on disk and does not expose it in the state', async () => {
    const store = new SettingsStore(folder, fakeEncryptor())
    const state = await store.setKey('sk-secret-123')
    expect(state.hasApiKey).toBe(true)
    expect(JSON.stringify(state)).not.toContain('sk-secret')
    expect((await readFile(join(folder, 'api-key.bin'))).toString('utf8')).not.toContain('sk-secret')
    expect(await store.readKey()).toBe('sk-secret-123')
    expect((await store.setKey('')).hasApiKey).toBe(false)
  })

  it('refuses to store the key without available encryption', async () => {
    const store = new SettingsStore(folder, fakeEncryptor(false))
    await expect(store.setKey('sk-x')).rejects.toThrow(/chiffrement/)
  })

  it('falls back to the defaults if the file is missing', async () => {
    const store = new SettingsStore(folder, fakeEncryptor())
    expect((await store.read()).provider).toBe('local')
  })
})

describe('service', () => {
  function service(factory: () => LlmProvider = () => new MockProvider()) {
    const db = openDatabase(':memory:')
    const settings = new SettingsStore(folder, fakeEncryptor())
    let received: { settings: Settings; key: string | null } | undefined
    const opened: string[] = []
    const api = createService({
      db,
      settings,
      models: new ModelManager({
        folder: join(folder, 'models'),
        resources: async () => ({ ramGb: 8, vramGb: 0 }),
        emit: () => undefined,
      }),
      pickAndReadCv: async () => ({ text: 'texte du cv', name: 'mon-cv.pdf' }),
      updater: {
        state: () => ({ version: '0.0.0', status: 'unavailable' as const }),
        check: async () => ({ version: '0.0.0', status: 'unavailable' as const }),
        install: () => undefined,
      },
      readCv: async (path) => `texte de ${path}`,
      openPath: async (path) => void opened.push(`ouvrir:${path}`),
      revealPath: (path) => void opened.push(`montrer:${path}`),
      renderHtml: async () => '',
      chooseDestination: async (name, extension) => join(folder, name.replace(/.w+$/, `.${extension}`)),
      generatePdf: async (html) => Buffer.from(`%PDF-fake ${html.length}`),
      createProvider: async (p, key) => {
        received = { settings: p, key }
        return factory()
      },
    })
    return { api, db, readReceived: () => received, opened }
  }

  it('imports a CV, then tailors it to a job posting and saves the result', async () => {
    const { api } = service()
    expect(await api.tailorCv({ jobTitle: 'Dev', rawText: 'x' }).catch((e: Error) => e.message)).toMatch(
      /importez d’abord/,
    )
    const imported = await api.importCv()
    expect(imported?.profile.fullName).toBeTruthy()
    const jobPosting = await api.parseJobPostingText('Offre développeur React')
    const generated = await api.tailorCv(jobPosting)
    expect(generated.cv.headline).toBeTruthy()
    expect(generated.id).toBeGreaterThan(0)
  })

  it('exports the approved CV to PDF and DOCX with the profile contact details', async () => {
    const { api } = service()
    const cannedCv = await new MockProvider().tailorCv(cannedProfile, { jobTitle: 'Dev', rawText: 'x' })
    await expect(api.exportCv(cannedCv, 'pdf')).rejects.toThrow(/importez d’abord/)
    await api.importCv()
    const pdf = await api.exportCv(cannedCv, 'pdf')
    const docx = await api.exportCv(cannedCv, 'docx')
    expect(pdf).toMatch(/CV-Claire-Dubois.pdf$/)
    expect((await readFile(pdf as string)).toString().startsWith('%PDF')).toBe(true)
    expect((await readFile(docx as string)).subarray(0, 2).toString()).toBe('PK')
  })

  it('imports a CV dropped on the window, given by its path', async () => {
    const { api } = service()
    const imported = await api.importDroppedCv('C:\\cv\\mon-cv.pdf')
    expect(imported.profile.fullName).toBeTruthy()
    expect((await api.getProfile())?.id).toBe(imported.id)
  })

  it('analyses the job posting only once: the confirmation card and the tailoring share the result', async () => {
    const mock = new MockProvider()
    let requestedAnalyses = 0
    let analysisReceived = false
    const { api } = service(() => ({
      extractProfile: (t) => mock.extractProfile(t),
      extractJobPosting: (t) => mock.extractJobPosting(t),
      generateSummary: (p) => mock.generateSummary(p),
      analyzeJobPosting: (o) => {
        requestedAnalyses++
        return mock.analyzeJobPosting(o)
      },
      tailorCv: (p, o, options) => {
        analysisReceived = options?.analysis !== undefined
        return mock.tailorCv(p, o, options)
      },
    }))
    const jobPosting = { jobTitle: 'Développeur React', rawText: 'Poste en CDI à temps plein. React, Figma.' }
    await expect(api.previewJobPosting(jobPosting)).rejects.toMatchObject({ code: 'profile-missing' })

    await api.importCv()
    const preview = await api.previewJobPosting(jobPosting)
    // « React » and « TypeScript » are in the profile, « Figma » is not: everything the job posting asks for is listed.
    expect(preview.soughtSkills).toEqual(['React', 'TypeScript', 'Figma', 'Autonomie'])
    expect(preview.contractType).toBe('CDI · temps plein')

    await api.previewJobPosting(jobPosting)
    await api.tailorCv(jobPosting)
    expect(requestedAnalyses).toBe(1)
    expect(analysisReceived).toBe(true)
  })

  it('cancels a tailoring in progress: the call fails with the « annule » code and nothing is saved', async () => {
    const mock = new MockProvider()
    let started: () => void = () => undefined
    const inProgress = new Promise<void>((resolveFn) => {
      started = resolveFn
    })
    const { api } = service(() => ({
      extractProfile: (t) => mock.extractProfile(t),
      extractJobPosting: (t) => mock.extractJobPosting(t),
      generateSummary: (p) => mock.generateSummary(p),
      analyzeJobPosting: (o) => mock.analyzeJobPosting(o),
      // Waits for the cancellation, like a model in the middle of a generation.
      tailorCv: (_p, _o, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason))
          started()
        }),
    }))
    await api.importCv()
    const tailoring = api.tailorCv({ jobTitle: 'Dev', rawText: 'x' })
    await inProgress
    await api.cancelTailoring()
    await expect(tailoring).rejects.toMatchObject({ code: 'cancelled' })
    // Cancelling with no tailoring in progress does nothing.
    await expect(api.cancelTailoring()).resolves.toBeUndefined()
  })

  it("only opens the files created by this session's export", async () => {
    const { api, opened } = service()
    const cannedCv = await new MockProvider().tailorCv(cannedProfile, { jobTitle: 'Dev', rawText: 'x' })
    await api.importCv()
    const pdf = (await api.exportCv(cannedCv, 'pdf')) as string

    await api.openFile(pdf)
    await api.revealInFolder(pdf)
    expect(opened).toEqual([`ouvrir:${pdf}`, `montrer:${pdf}`])

    await expect(api.openFile('C:\\Windows\\System32\\cmd.exe')).rejects.toThrow(/pas été créé par Re:CV/)
    await expect(api.revealInFolder(join(folder, 'autre.pdf'))).rejects.toThrow(/pas été créé par Re:CV/)
    expect(opened).toHaveLength(2)
  })

  it('reports a folder that cannot be written to with the « ecriture-impossible » code', async () => {
    const db = openDatabase(':memory:')
    const api = createService({
      db,
      settings: new SettingsStore(folder, fakeEncryptor()),
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
      // Missing folder: writing fails.
      chooseDestination: async () => join(folder, 'absent', 'cv.pdf'),
      generatePdf: async () => Buffer.from('%PDF'),
      createProvider: async () => new MockProvider(),
    })
    await api.importCv()
    const cannedCv = await new MockProvider().tailorCv(cannedProfile, { jobTitle: 'Dev', rawText: 'x' })
    await expect(api.exportCv(cannedCv, 'pdf')).rejects.toMatchObject({ code: 'write-failed' })
  })

  it('passes the settings and the key to the provider factory', async () => {
    const { api, readReceived } = service()
    await api.setApiKey('sk-abc')
    await api.importCv()
    expect(readReceived()?.key).toBe('sk-abc')
  })
})

describe('lireCv', () => {
  it('refuses what is neither a PDF nor a DOCX, without reading the file', async () => {
    const path = join(folder, 'secret.txt')
    await writeFile(path, 'contenu privé')
    await expect(readCv(path)).rejects.toMatchObject({ code: 'unreadable-file' })
    await expect(readCv('C:\\Windows\\System32\\cmd.exe')).rejects.toMatchObject({ code: 'unreadable-file' })
  })

  it('reports a missing or unreadable file with the same code', async () => {
    await expect(readCv(join(folder, 'absent.pdf'))).rejects.toMatchObject({ code: 'unreadable-file' })
    const fake = join(folder, 'faux.docx')
    await writeFile(fake, 'ceci n’est pas un document Word')
    await expect(readCv(fake)).rejects.toMatchObject({ code: 'unreadable-file' })
  })
})
