import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DiagnosticLog } from './diagnosticLog'

const folders: string[] = []
const newFolder = () => {
  const folder = mkdtempSync(join(tmpdir(), 'recv-log-'))
  folders.push(folder)
  return join(folder, 'logs')
}
afterEach(() => {
  for (const f of folders.splice(0)) rmSync(f, { recursive: true, force: true })
})

const entry = (n: number) => ({ at: `2026-10-14T10:00:${String(n).padStart(2, '0')}.000Z`, kind: 'start' as const })

describe('DiagnosticLog', () => {
  it('appends one JSON line per entry and returns the most recent ones', () => {
    const log = new DiagnosticLog(newFolder())
    for (let n = 0; n < 5; n++) log.append(entry(n))
    expect(log.recent(2)).toEqual([JSON.stringify(entry(3)), JSON.stringify(entry(4))])
  })

  it('rotates the file when it grows too large, keeping a single older file', () => {
    const folder = newFolder()
    const log = new DiagnosticLog(folder, 300)
    for (let n = 0; n < 40; n++) log.append(entry(n))
    expect(readdirSync(folder).sort()).toEqual(['recv.1.log', 'recv.log'])
    // Recent lines span the two files when needed.
    expect(log.recent(8).at(-1)).toBe(JSON.stringify(entry(39)))
    expect(log.recent(8)).toHaveLength(8)
  })

  it('never throws: a log that cannot be written is simply empty', () => {
    const log = new DiagnosticLog(join(newFolder(), '\0invalid'))
    expect(() => log.append(entry(0))).not.toThrow()
    expect(log.recent(5)).toEqual([])
  })
})
