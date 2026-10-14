// Local diagnostic log: what is needed to understand a bug report, and nothing of the CV. An error is recorded by its
// code and its class name only: messages are never kept, as those of the model libraries may quote the CV or the prompt.

export interface DiagnosticEntry {
  at: string
  kind: 'start' | 'error' | 'crash'
  /** IPC channel of the failed call. */
  channel?: string
  /** Stable error code (`unreadable-file`, `network`, `ENOENT`…). */
  code?: string
  /** Error class name (`TypeError`, `NoObjectGeneratedError`…). */
  name?: string
  /** Application version, on `start`. */
  version?: string
  /** Why a window process ended, on `crash` (a fixed Electron value). */
  reason?: string
}

// Only plain identifiers are kept: a free text could hold personal data.
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,59}$/
const identifier = (value: unknown): string | undefined =>
  typeof value === 'string' && IDENTIFIER.test(value) ? value : undefined

export function errorEntry(channel: string, error: unknown, at = new Date()): DiagnosticEntry {
  const fields = error !== null && typeof error === 'object' ? (error as { code?: unknown; name?: unknown }) : {}
  return { at: at.toISOString(), kind: 'error', channel, code: identifier(fields.code), name: identifier(fields.name) }
}

export interface ReportEnvironment {
  version: string
  os: string
  provider: string
  ramGb: number
  vramGb: number
}

/** Text the user pastes in a bug report: the environment, then the recent log lines. */
export function buildReport(environment: ReportEnvironment, lines: readonly string[]): string {
  return [
    `Re:CV ${environment.version}`,
    environment.os,
    `Engine: ${environment.provider}`,
    `Memory: ${environment.ramGb} GB RAM, ${environment.vramGb} GB VRAM`,
    '',
    'Recent events (no CV data):',
    ...(lines.length > 0 ? lines : ['(none)']),
  ].join('\n')
}
