import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleWithin } from './timeout'

describe('settleWithin', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves as soon as the task ends', async () => {
    let done = false
    void settleWithin(Promise.resolve(), 5000).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('resolves after the delay when the task never ends', async () => {
    let done = false
    void settleWithin(new Promise(() => undefined), 5000).then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(4999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
  })

  it('resolves even when the task fails', async () => {
    await expect(settleWithin(Promise.reject(new Error('boom')), 5000)).resolves.toBeUndefined()
  })
})
