import { describe, expect, it } from 'vitest'
import { buildReport, errorEntry } from './diagnostics'
import { CodedError } from './errors'

const at = new Date('2026-10-14T10:00:00.000Z')

describe('errorEntry', () => {
  it('keeps the channel, the code and the class name, never the message', () => {
    const entry = errorEntry('cv:import', new CodedError('unreadable-file', 'CV de Camille Martin illisible'), at)
    expect(entry).toEqual({
      at: '2026-10-14T10:00:00.000Z',
      kind: 'error',
      channel: 'cv:import',
      code: 'unreadable-file',
      name: 'CodedError',
    })
    expect(JSON.stringify(entry)).not.toContain('Camille')
  })

  it('gives no code to an error without one, and no name that is not a plain identifier', () => {
    expect(errorEntry('cv:tailor', new TypeError('x'), at)).toMatchObject({ code: undefined, name: 'TypeError' })
    const odd = new Error('x')
    odd.name = 'Camille Martin <camille@exemple.fr>'
    expect(errorEntry('cv:tailor', odd, at).name).toBeUndefined()
    expect(errorEntry('cv:tailor', 'chaîne levée', at).name).toBeUndefined()
  })
})

describe('buildReport', () => {
  it('puts the environment first, then the recent log lines', () => {
    const report = buildReport(
      { version: '0.3.0', os: 'Windows 10.0.26100', provider: 'local', ramGb: 16, vramGb: 8 },
      ['{"kind":"start"}', '{"kind":"error"}'],
    )
    expect(report).toBe(
      [
        'Re:CV 0.3.0',
        'Windows 10.0.26100',
        'Engine: local',
        'Memory: 16 GB RAM, 8 GB VRAM',
        '',
        'Recent events (no CV data):',
        '{"kind":"start"}',
        '{"kind":"error"}',
      ].join('\n'),
    )
  })

  it('says so when the log is empty', () => {
    const report = buildReport({ version: '0.3.0', os: 'Windows', provider: 'api', ramGb: 8, vramGb: 0 }, [])
    expect(report.endsWith('(none)')).toBe(true)
  })
})
