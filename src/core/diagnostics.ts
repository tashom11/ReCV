// Local diagnostic log: what is needed to understand a bug report, and nothing of the CV. An error is recorded by its
// code and its class name only: messages are never kept, as those of the model libraries may quote the CV or the prompt.

/** How many items of each kind a profile holds: numbers only, never any content. */
export interface ProfileCounts {
  experiences: number
  skills: number
  education: number
  languages: number
}

/** What a CV import gave: the text length, what the model returned, what survived the filter against inventions. */
export interface ExtractionCounts {
  textLength: number
  raw: ProfileCounts
  kept: ProfileCounts
}

export interface DiagnosticEntry {
  at: string
  kind: 'start' | 'error' | 'crash' | 'extraction'
  /** Counts of a CV import, on `extraction`. */
  extraction?: ExtractionCounts
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

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100_000, Math.trunc(value))) : 0

const profileCounts = (value: Partial<ProfileCounts>): ProfileCounts => ({
  experiences: count(value.experiences),
  skills: count(value.skills),
  education: count(value.education),
  languages: count(value.languages),
})

/** Log entry of a CV import: only bounded integers are kept. */
export function extractionEntry(counts: ExtractionCounts, at = new Date()): DiagnosticEntry {
  return {
    at: at.toISOString(),
    kind: 'extraction',
    extraction: {
      textLength: count(counts.textLength),
      raw: profileCounts(counts.raw),
      kept: profileCounts(counts.kept),
    },
  }
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
