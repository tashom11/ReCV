import { EventEmitter } from 'node:events'
import type { UpdateState } from '@core/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type UpdateEngine, Updater } from './updater'

// Fake electron-updater: the check emits the events planned by the scenario.
function fakeEngine(scenario: (engine: EventEmitter) => void | Promise<void>) {
  const sender = new EventEmitter()
  const engine = Object.assign(sender, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checks: 0,
    installations: 0,
    async checkForUpdatesAndNotify() {
      engine.checks++
      sender.emit('checking-for-update')
      await scenario(sender)
    },
    quitAndInstall() {
      engine.installations++
    },
  })
  return engine
}

function create(engine: ReturnType<typeof fakeEngine>, installed = true, intervalMs?: number) {
  const states: UpdateState[] = []
  const manager = new Updater({
    version: '0.2.0',
    installed,
    engine: () => engine as unknown as UpdateEngine,
    emit: (state) => void states.push(state),
    intervalMs,
  })
  return { manager, states }
}

afterEach(() => vi.useRealTimers())

describe('GestionnaireMiseAJour', () => {
  it('does nothing outside the installed application, and says so', async () => {
    const engine = fakeEngine(() => undefined)
    const { manager } = create(engine, false)
    manager.start()
    expect(manager.state()).toEqual({ version: '0.2.0', status: 'indisponible' })
    await manager.check()
    expect(engine.checks).toBe(0)
  })

  it('reports that the application is up to date', async () => {
    const engine = fakeEngine((m) => void m.emit('update-not-available'))
    const { manager, states } = create(engine)
    manager.start()
    await vi.waitFor(() => expect(manager.state().status).toBe('a-jour'))
    expect(engine.autoDownload).toBe(true)
    expect(engine.autoInstallOnAppQuit).toBe(true)
    expect(states.map((e) => e.status)).toEqual(['verification', 'a-jour'])
    expect(manager.state().checkedAt).toBeGreaterThan(0)
    manager.stop()
  })

  it('follows the download then offers to install the new version', async () => {
    const engine = fakeEngine((m) => {
      m.emit('update-available', { version: '0.3.0' })
      m.emit('download-progress', { percent: 41.6 })
      m.emit('update-downloaded', { version: '0.3.0' })
    })
    const { manager, states } = create(engine)
    expect(() => manager.install()).toThrow(/Aucune mise à jour/)
    manager.start()
    await vi.waitFor(() => expect(manager.state().status).toBe('prete'))
    expect(states.map((e) => `${e.status}:${e.percent ?? ''}`)).toEqual([
      'verification:',
      'telechargement:0',
      'telechargement:42',
      'prete:100',
    ])
    expect(manager.state().newVersion).toBe('0.3.0')

    // A ready version stays ready: neither a new check nor an error clears it.
    await manager.check()
    expect(engine.checks).toBe(1)
    engine.emit('error', new Error('réseau'))
    expect(manager.state().status).toBe('prete')

    manager.install()
    expect(engine.installations).toBe(1)
    manager.stop()
  })

  it('makes a failure visible (offline, repository unreachable) and allows retrying', async () => {
    let online = false
    const engine = fakeEngine((m) => {
      if (!online) throw new Error('net::ERR_INTERNET_DISCONNECTED')
      m.emit('update-not-available')
    })
    const { manager } = create(engine)
    manager.start()
    await vi.waitFor(() => expect(manager.state().status).toBe('erreur'))
    expect(manager.state().message).toContain('ERR_INTERNET_DISCONNECTED')

    online = true
    expect((await manager.check()).status).toBe('a-jour')
    expect(manager.state().message).toBeUndefined()
    manager.stop()
  })

  it('checks again at regular intervals while the application stays open', async () => {
    vi.useFakeTimers()
    const engine = fakeEngine((m) => void m.emit('update-not-available'))
    const { manager } = create(engine, true, 1_000)
    manager.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.checks).toBe(1)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(engine.checks).toBe(4)
    manager.stop()
    await vi.advanceTimersByTimeAsync(3_000)
    expect(engine.checks).toBe(4)
  })
})
