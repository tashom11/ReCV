import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { DiagnosticEntry } from '@core/diagnostics'

const DEFAULT_MAX_BYTES = 200 * 1024

/**
 * Local diagnostic log (`userData/logs`): one JSON line per entry, in `recv.log`, moved to `recv.1.log` when it grows
 * too large. Never sent anywhere: the user copies a report from the settings. Logging must never break the app: every
 * failure is ignored.
 */
export class DiagnosticLog {
  private readonly current: string
  private readonly previous: string

  constructor(
    private readonly folder: string,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {
    this.current = join(folder, 'recv.log')
    this.previous = join(folder, 'recv.1.log')
  }

  append(entry: DiagnosticEntry): void {
    try {
      mkdirSync(this.folder, { recursive: true })
      if (existsSync(this.current) && statSync(this.current).size > this.maxBytes)
        renameSync(this.current, this.previous)
      appendFileSync(this.current, `${JSON.stringify(entry)}\n`)
    } catch {
      // ignored: a diagnostic log is never worth an error
    }
  }

  /** The `count` most recent lines, oldest first. */
  recent(count: number): string[] {
    const lines = [this.previous, this.current].flatMap((file) => {
      try {
        return readFileSync(file, 'utf8').split('\n').filter(Boolean)
      } catch {
        return []
      }
    })
    return lines.slice(-count)
  }
}
