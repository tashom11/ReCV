import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrateDataFolder } from './dataFolder'

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-data-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

describe('migrateDataFolder', () => {
  it('renames the v0.2.1 files and folder to their English names', async () => {
    await writeFile(join(folder, 'parametres.json'), '{"version":2,"provider":"local"}')
    await writeFile(join(folder, 'cle-api.bin'), 'secret')
    await mkdir(join(folder, 'modeles'))
    await writeFile(join(folder, 'modeles', 'Qwen.gguf'), 'weights')

    await migrateDataFolder(folder)

    expect(await readFile(join(folder, 'settings.json'), 'utf8')).toContain('"provider":"local"')
    expect(await readFile(join(folder, 'api-key.bin'), 'utf8')).toBe('secret')
    expect(await readFile(join(folder, 'models', 'Qwen.gguf'), 'utf8')).toBe('weights')
    for (const old of ['parametres.json', 'cle-api.bin', 'modeles']) expect(await exists(join(folder, old))).toBe(false)
  })

  it('points the selected local model to its new folder', async () => {
    const oldPath = join(folder, 'modeles', 'Qwen.gguf')
    await mkdir(join(folder, 'modeles'))
    await writeFile(oldPath, 'weights')
    await writeFile(join(folder, 'parametres.json'), JSON.stringify({ version: 2, localModelPath: oldPath }))

    await migrateDataFolder(folder)

    const settings = JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'))
    expect(settings.localModelPath).toBe(join(folder, 'models', 'Qwen.gguf'))
  })

  it('also updates the path in a real v0.2.1 settings file (French key, no version)', async () => {
    const oldPath = join(folder, 'modeles', 'Qwen.gguf')
    await mkdir(join(folder, 'modeles'))
    await writeFile(oldPath, 'weights')
    await writeFile(
      join(folder, 'parametres.json'),
      JSON.stringify({ fournisseur: 'local', cheminModeleLocal: oldPath }),
    )

    await migrateDataFolder(folder)

    const settings = JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8'))
    expect(settings.cheminModeleLocal).toBe(join(folder, 'models', 'Qwen.gguf'))
  })

  it('leaves a model chosen elsewhere where it is', async () => {
    const elsewhere = join('D:', 'mes-modeles', 'autre.gguf')
    await writeFile(join(folder, 'parametres.json'), JSON.stringify({ version: 2, localModelPath: elsewhere }))

    await migrateDataFolder(folder)

    expect(JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8')).localModelPath).toBe(elsewhere)
  })

  it('does nothing on a folder that is already up to date, or empty', async () => {
    await writeFile(join(folder, 'settings.json'), '{"version":2}')
    await migrateDataFolder(folder)
    await migrateDataFolder(join(folder, 'missing'))
    expect(await readFile(join(folder, 'settings.json'), 'utf8')).toBe('{"version":2}')
  })
})
