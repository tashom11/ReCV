export type AutosaveStatus = 'saving' | 'saved' | 'error'

export interface Autosave<T> {
  /** Remembers `value` and saves it once `delayMs` has elapsed without a newer value. */
  schedule(value: T): void
  /** Saves the pending value now (no-op if nothing is pending). A failed value stays pending. */
  flush(): Promise<void>
  /** Forgets the pending value without saving it. */
  cancel(): void
}

/** Debounced saving, independent of React so it can be tested on its own. */
export function createAutosave<T>({
  delayMs,
  save,
  onStatus,
}: {
  delayMs: number
  save: (value: T) => Promise<void>
  onStatus?: (status: AutosaveStatus) => void
}): Autosave<T> {
  let pending: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const flush = async () => {
    clearTimer()
    if (!pending) return
    const current = pending
    pending = null
    onStatus?.('saving')
    try {
      await save(current.value)
      onStatus?.('saved')
    } catch {
      // A newer value scheduled meanwhile wins; otherwise the failed one is retried on the next flush.
      pending ??= current
      onStatus?.('error')
    }
  }

  return {
    schedule(value) {
      pending = { value }
      clearTimer()
      timer = setTimeout(() => void flush(), delayMs)
    },
    flush,
    cancel() {
      clearTimer()
      pending = null
    },
  }
}
