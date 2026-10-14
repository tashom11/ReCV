import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cannedProfile, MockProvider } from '@core/llm'
import { tailoredCvSchema } from '@core/schemas'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db/connection'
import { ModelManager } from './models/manager'
import { createService } from './service'
import { SettingsStore } from './settingsStore'

const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-mod-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

function create() {
  const settings = new SettingsStore(folder, {
    isAvailable: () => true,
    encrypt: (t) => Buffer.from(t),
    decrypt: (b) => b.toString(),
  })
  const pdfs: string[] = []
  const service = createService({
    db: openDatabase(':memory:'),
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
    chooseDestination: async (name, extension) => join(folder, name.replace(/\.\w+$/, `.${extension}`)),
    generatePdf: async (html) => {
      pdfs.push(html)
      return Buffer.from('%PDF-fake')
    },
    createProvider: async () => new MockProvider(),
  })
  return { service, settings, pdfs }
}

const cv = tailoredCvSchema.parse({ headline: 'Dev', summary: 'Je fais preuve de rigueur.' })

describe('CV templates and photo', () => {
  it('returns the HTML of a template with the profile photo', async () => {
    const { service } = create()
    await service.saveProfile({ ...cannedProfile, photo: PHOTO })
    const html = await service.templateHtml(cv, 'elegant')
    expect(html).toContain('data-template="elegant"')
    expect(html).toContain('<img class="photo"')
  })

  it('exports with the requested template, otherwise with the one in the settings', async () => {
    const { service, settings, pdfs } = create()
    await service.saveProfile(cannedProfile)

    await service.exportCv(cv, 'pdf', 'banner')
    expect(pdfs.at(-1)).toContain('data-template="banner"')

    await settings.save({ ...(await settings.read()), cvTemplate: 'modern' })
    await service.exportCv(cv, 'pdf')
    expect(pdfs.at(-1)).toContain('data-template="modern"')
  })

  it('importing another CV keeps the photo of the active profile', async () => {
    const { service } = create()
    await service.saveProfile({ ...cannedProfile, photo: PHOTO })
    const imported = await service.importCv()
    expect(imported?.profile.photo).toBe(PHOTO)
  })
})
