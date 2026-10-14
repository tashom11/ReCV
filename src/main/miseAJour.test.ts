import { EventEmitter } from 'node:events'
import type { UpdateState } from '@core/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GestionnaireMiseAJour, type MoteurMiseAJour } from './miseAJour'

// Faux electron-updater : la vérification émet les événements prévus par le scénario.
function fauxMoteur(scenario: (moteur: EventEmitter) => void | Promise<void>) {
  const emetteur = new EventEmitter()
  const moteur = Object.assign(emetteur, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    verifications: 0,
    installations: 0,
    async checkForUpdatesAndNotify() {
      moteur.verifications++
      emetteur.emit('checking-for-update')
      await scenario(emetteur)
    },
    quitAndInstall() {
      moteur.installations++
    },
  })
  return moteur
}

function creer(moteur: ReturnType<typeof fauxMoteur>, installee = true, intervalleMs?: number) {
  const etats: UpdateState[] = []
  const gestionnaire = new GestionnaireMiseAJour({
    version: '0.2.0',
    installee,
    moteur: () => moteur as unknown as MoteurMiseAJour,
    emettre: (etat) => void etats.push(etat),
    intervalleMs,
  })
  return { gestionnaire, etats }
}

afterEach(() => vi.useRealTimers())

describe('GestionnaireMiseAJour', () => {
  it('ne fait rien hors de l’application installée, et le dit', async () => {
    const moteur = fauxMoteur(() => undefined)
    const { gestionnaire } = creer(moteur, false)
    gestionnaire.demarrer()
    expect(gestionnaire.etat()).toEqual({ version: '0.2.0', status: 'indisponible' })
    await gestionnaire.verifier()
    expect(moteur.verifications).toBe(0)
  })

  it('signale que l’application est à jour', async () => {
    const moteur = fauxMoteur((m) => void m.emit('update-not-available'))
    const { gestionnaire, etats } = creer(moteur)
    gestionnaire.demarrer()
    await vi.waitFor(() => expect(gestionnaire.etat().status).toBe('a-jour'))
    expect(moteur.autoDownload).toBe(true)
    expect(moteur.autoInstallOnAppQuit).toBe(true)
    expect(etats.map((e) => e.status)).toEqual(['verification', 'a-jour'])
    expect(gestionnaire.etat().checkedAt).toBeGreaterThan(0)
    gestionnaire.arreter()
  })

  it('suit le téléchargement puis propose d’installer la nouvelle version', async () => {
    const moteur = fauxMoteur((m) => {
      m.emit('update-available', { version: '0.3.0' })
      m.emit('download-progress', { percent: 41.6 })
      m.emit('update-downloaded', { version: '0.3.0' })
    })
    const { gestionnaire, etats } = creer(moteur)
    expect(() => gestionnaire.installer()).toThrow(/Aucune mise à jour/)
    gestionnaire.demarrer()
    await vi.waitFor(() => expect(gestionnaire.etat().status).toBe('prete'))
    expect(etats.map((e) => `${e.status}:${e.percent ?? ''}`)).toEqual([
      'verification:',
      'telechargement:0',
      'telechargement:42',
      'prete:100',
    ])
    expect(gestionnaire.etat().newVersion).toBe('0.3.0')

    // Une version prête le reste : ni nouvelle vérification, ni erreur ne l'effacent.
    await gestionnaire.verifier()
    expect(moteur.verifications).toBe(1)
    moteur.emit('error', new Error('réseau'))
    expect(gestionnaire.etat().status).toBe('prete')

    gestionnaire.installer()
    expect(moteur.installations).toBe(1)
    gestionnaire.arreter()
  })

  it('rend visible un échec (hors ligne, dépôt inaccessible) et permet de réessayer', async () => {
    let enLigne = false
    const moteur = fauxMoteur((m) => {
      if (!enLigne) throw new Error('net::ERR_INTERNET_DISCONNECTED')
      m.emit('update-not-available')
    })
    const { gestionnaire } = creer(moteur)
    gestionnaire.demarrer()
    await vi.waitFor(() => expect(gestionnaire.etat().status).toBe('erreur'))
    expect(gestionnaire.etat().message).toContain('ERR_INTERNET_DISCONNECTED')

    enLigne = true
    expect((await gestionnaire.verifier()).status).toBe('a-jour')
    expect(gestionnaire.etat().message).toBeUndefined()
    gestionnaire.arreter()
  })

  it('revérifie à intervalle régulier tant que l’application reste ouverte', async () => {
    vi.useFakeTimers()
    const moteur = fauxMoteur((m) => void m.emit('update-not-available'))
    const { gestionnaire } = creer(moteur, true, 1_000)
    gestionnaire.demarrer()
    await vi.advanceTimersByTimeAsync(0)
    expect(moteur.verifications).toBe(1)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(moteur.verifications).toBe(4)
    gestionnaire.arreter()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(moteur.verifications).toBe(4)
  })
})
