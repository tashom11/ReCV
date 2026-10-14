import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AutosaveStatus, createAutosave } from './autosave'

describe('createAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves only the latest value once the delay has elapsed without changes', async () => {
    const saved: string[] = []
    const autosave = createAutosave<string>({ delayMs: 800, save: async (v) => void saved.push(v) })

    autosave.schedule('a')
    await vi.advanceTimersByTimeAsync(500)
    autosave.schedule('ab')
    await vi.advanceTimersByTimeAsync(799)
    expect(saved).toEqual([])

    await vi.advanceTimersByTimeAsync(1)
    expect(saved).toEqual(['ab'])
  })

  it('flush saves the pending value immediately and only once', async () => {
    const saved: string[] = []
    const autosave = createAutosave<string>({ delayMs: 800, save: async (v) => void saved.push(v) })

    autosave.schedule('draft')
    await autosave.flush()
    await vi.advanceTimersByTimeAsync(1000)

    expect(saved).toEqual(['draft'])
  })

  it('flush does nothing when no change is pending', async () => {
    const save = vi.fn(async () => undefined)
    const autosave = createAutosave<string>({ delayMs: 800, save })

    await autosave.flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('cancel drops the pending value', async () => {
    const save = vi.fn(async () => undefined)
    const autosave = createAutosave<string>({ delayMs: 800, save })

    autosave.schedule('draft')
    autosave.cancel()
    await vi.advanceTimersByTimeAsync(1000)
    await autosave.flush()

    expect(save).not.toHaveBeenCalled()
  })

  it('reports saving, saved and error statuses', async () => {
    const statuses: AutosaveStatus[] = []
    let fail = false
    const autosave = createAutosave<string>({
      delayMs: 800,
      save: async () => {
        if (fail) throw new Error('disk full')
      },
      onStatus: (status) => statuses.push(status),
    })

    autosave.schedule('a')
    await autosave.flush()
    fail = true
    autosave.schedule('b')
    await autosave.flush()

    expect(statuses).toEqual(['saving', 'saved', 'saving', 'error'])
  })

  it('keeps a value that failed to save pending, so the next flush retries it', async () => {
    const saved: string[] = []
    let fail = true
    const autosave = createAutosave<string>({
      delayMs: 800,
      save: async (v) => {
        if (fail) throw new Error('disk full')
        saved.push(v)
      },
    })

    autosave.schedule('draft')
    await autosave.flush()
    fail = false
    await autosave.flush()

    expect(saved).toEqual(['draft'])
  })
})
