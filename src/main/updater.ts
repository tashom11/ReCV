import type { UpdateState } from '@core/api'

/** What the updater expects from `electron-updater` (injectable for tests). */
export interface UpdateEngine {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  /** Checks the releases; downloads the new version if there is one and notifies. */
  checkForUpdatesAndNotify(): Promise<unknown>
  quitAndInstall(): void
  on(event: string, rappel: (...args: never[]) => void): unknown
}

export interface UpdaterDeps {
  /** Version of the running application. */
  version: string
  /** False in development: there is nothing to update then. */
  installed: boolean
  engine: () => UpdateEngine
  emit: (state: UpdateState) => void
  /** Delay between two checks while the application stays open. */
  intervalMs?: number
}

// An application left open for several days must still learn that a version is out.
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Follows updates (GitHub releases): check at startup, then at regular intervals and on demand.
 * Every state change is passed to the interface, errors included: an unreachable repository or a lost connection does
 * not get in the way, but no longer goes unnoticed.
 */
export class Updater {
  private current: UpdateState
  private timer: ReturnType<typeof setInterval> | null = null
  private engine: UpdateEngine | null = null

  constructor(private readonly deps: UpdaterDeps) {
    this.current = { version: deps.version, status: deps.installed ? 'idle' : 'unavailable' }
  }

  state(): UpdateState {
    return this.current
  }

  private setState(partial: Partial<UpdateState>): void {
    this.current = { ...this.current, ...partial }
    this.deps.emit(this.current)
  }

  /** Wires the engine, starts the first check and schedules the next ones. */
  start(): void {
    if (!this.deps.installed || this.engine) return
    const engine = this.deps.engine()
    this.engine = engine
    engine.autoDownload = true
    engine.autoInstallOnAppQuit = true
    engine.on('checking-for-update', () => {
      // A version already ready stays ready: the next check must not remove it from the screen.
      if (this.current.status !== 'ready') this.setState({ status: 'checking', message: undefined })
    })
    engine.on('update-not-available', () => this.setState({ status: 'up-to-date', checkedAt: Date.now() }))
    engine.on('update-available', (info: { version: string }) =>
      this.setState({ status: 'downloading', newVersion: info.version, percent: 0 }),
    )
    engine.on('download-progress', (progress: { percent: number }) =>
      this.setState({ status: 'downloading', percent: Math.round(progress.percent) }),
    )
    engine.on('update-downloaded', (info: { version: string }) =>
      this.setState({ status: 'ready', newVersion: info.version, percent: 100, checkedAt: Date.now() }),
    )
    engine.on('error', (error: Error) => this.failure(error))

    void this.check()
    this.timer = setInterval(() => void this.check(), this.deps.intervalMs ?? DEFAULT_INTERVAL_MS)
    // The timer must not keep the application open.
    this.timer.unref?.()
  }

  private failure(error: unknown): void {
    if (this.current.status === 'ready') return
    this.setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
  }

  /** Checks now. No effect during a check or a download, or if a version is ready. */
  async check(): Promise<UpdateState> {
    const { status: state } = this.current
    if (!this.engine || state === 'checking' || state === 'downloading' || state === 'ready') return this.current
    try {
      await this.engine.checkForUpdatesAndNotify()
    } catch (error) {
      this.failure(error)
    }
    return this.current
  }

  /** Quits the application and installs the downloaded version. */
  install(): void {
    if (this.current.status !== 'ready' || !this.engine) {
      throw new Error('Aucune mise à jour n’est prête à être installée.')
    }
    this.engine.quitAndInstall()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
