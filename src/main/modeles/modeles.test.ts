import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProgressionModele } from '@core/api'
import { MODELES_EMBARQUES, proposerModele } from '@core/llm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GestionnaireModeles } from './gestionnaire'
import { telechargerFichier } from './telechargement'

describe('proposerModele', () => {
  it('choisit le plus gros modèle supporté par la RAM ou la VRAM', () => {
    expect(proposerModele({ ramGo: 4, vramGo: 0 }).id).toBe('qwen3.5-2b')
    expect(proposerModele({ ramGo: 8, vramGo: 0 }).id).toBe('qwen3.5-4b')
    expect(proposerModele({ ramGo: 16, vramGo: 0 }).id).toBe('qwen3.5-9b')
    expect(proposerModele({ ramGo: 8, vramGo: 8 }).id).toBe('qwen3.5-9b')
  })

  it('retombe sur le plus petit si la machine est sous tous les seuils', () => {
    expect(proposerModele({ ramGo: 2, vramGo: 0 }).id).toBe('qwen3.5-2b')
  })

  it('référence des URLs Hugging Face et des empreintes SHA-256 valides', () => {
    for (const m of MODELES_EMBARQUES) {
      expect(m.url).toMatch(/^https:\/\/huggingface\.co\/.+\.gguf$/)
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('telechargerFichier', () => {
  const contenu = Buffer.from(`${'x'.repeat(10_000)}fin du modèle`)
  const sha256 = createHash('sha256').update(contenu).digest('hex')
  let serveur: Server
  let url: string
  let dossier: string
  let requetesRange: (string | undefined)[]

  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'recv-dl-'))
    requetesRange = []
    serveur = createServer((req, res) => {
      requetesRange.push(req.headers.range)
      const debut = req.headers.range ? Number(/bytes=(\d+)-/.exec(req.headers.range)?.[1]) : 0
      res.statusCode = debut > 0 ? 206 : 200
      res.setHeader('content-length', contenu.length - debut)
      res.end(contenu.subarray(debut))
    })
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok))
    url = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/m.gguf`
  })
  afterEach(async () => {
    serveur.close()
    await rm(dossier, { recursive: true, force: true })
  })

  it('télécharge, vérifie l’empreinte et renomme le fichier', async () => {
    const destination = join(dossier, 'm.gguf')
    const progressions: number[] = []
    await telechargerFichier({
      url,
      destination,
      tailleOctets: contenu.length,
      sha256,
      surProgression: (recu) => progressions.push(recu),
    })
    expect(await readFile(destination)).toEqual(contenu)
    expect(progressions.at(-1)).toBe(contenu.length)
    await expect(stat(`${destination}.part`)).rejects.toThrow()
  })

  it('reprend un téléchargement partiel avec un en-tête Range', async () => {
    const destination = join(dossier, 'm.gguf')
    await writeFile(`${destination}.part`, contenu.subarray(0, 4_000))
    await telechargerFichier({ url, destination, tailleOctets: contenu.length, sha256 })
    expect(requetesRange).toEqual(['bytes=4000-'])
    expect(await readFile(destination)).toEqual(contenu)
  })

  it('rejette un fichier corrompu et supprime le partiel', async () => {
    const destination = join(dossier, 'm.gguf')
    await expect(
      telechargerFichier({ url, destination, tailleOctets: contenu.length, sha256: '0'.repeat(64) }),
    ).rejects.toThrow(/corrompu/)
    await expect(stat(destination)).rejects.toThrow()
    await expect(stat(`${destination}.part`)).rejects.toThrow()
  })
})

describe('GestionnaireModeles', () => {
  let dossier: string
  beforeEach(async () => {
    dossier = await mkdtemp(join(tmpdir(), 'recv-gm-'))
  })
  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true })
  })

  it('recommande un modèle, installe puis supprime', async () => {
    const evenements: ProgressionModele[] = []
    const installes: string[] = []
    const gestionnaire = new GestionnaireModeles({
      dossier,
      ressources: async () => ({ ramGo: 8, vramGo: 0 }),
      emettre: (p) => evenements.push(p),
      apresInstallation: async (chemin) => void installes.push(chemin),
      telecharger: async ({ destination, tailleOctets, surProgression }) => {
        // Fichier creux : pas de vraies écritures de plusieurs Go.
        await writeFile(destination, '')
        await truncate(destination, tailleOctets)
        surProgression?.(tailleOctets, tailleOctets)
      },
    })

    const avant = await gestionnaire.etat()
    expect(avant.modeles.find((m) => m.recommande)?.id).toBe('qwen3.5-4b')
    expect(avant.modeles.every((m) => !m.installe)).toBe(true)

    await gestionnaire.telecharger('qwen3.5-4b')
    expect(installes).toHaveLength(1)
    expect(evenements.at(-1)?.etat).toBe('termine')
    expect((await gestionnaire.etat()).modeles.find((m) => m.id === 'qwen3.5-4b')?.installe).toBe(true)

    await gestionnaire.supprimer('qwen3.5-4b')
    expect((await gestionnaire.etat()).modeles.every((m) => !m.installe)).toBe(true)
  })

  it('refuse un identifiant inconnu et deux téléchargements simultanés', async () => {
    let debloquer: () => void = () => undefined
    const gestionnaire = new GestionnaireModeles({
      dossier,
      ressources: async () => ({ ramGo: 8, vramGo: 0 }),
      emettre: () => undefined,
      telecharger: () => new Promise<void>((ok) => (debloquer = ok)),
    })
    await expect(gestionnaire.telecharger('inconnu')).rejects.toThrow(/inconnu/)
    const premier = gestionnaire.telecharger('qwen3.5-2b')
    await expect(gestionnaire.telecharger('qwen3.5-4b')).rejects.toThrow(/déjà en cours/)
    debloquer()
    await premier
  })
})
