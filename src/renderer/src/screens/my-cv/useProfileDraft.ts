import type { Profile } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { type AutosaveStatus, createAutosave } from '../../autosave'
import { cleanProfile } from './profileDraft'

// Pause in typing after which the draft is saved.
const AUTOSAVE_DELAY_MS = 800

/**
 * Draft of the profile being checked at step ①. It is saved after a pause in typing, and handed to the app when the
 * screen is left by any route (stepper, settings): no correction is ever lost.
 */
export function useProfileDraft(profile: Profile | null, onProfile: (profile: Profile) => void) {
  const [draft, setDraft] = useState<Profile | null>(profile)
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus | null>(null)
  const [autosave] = useState(() =>
    createAutosave<Profile>({
      delayMs: AUTOSAVE_DELAY_MS,
      save: async (value) => void (await window.api.saveProfile(cleanProfile(value))),
      onStatus: setSaveStatus,
    }),
  )
  // The draft differs from the profile known to the app.
  const dirty = useRef(false)
  const latest = useRef({ draft, onProfile })
  latest.current = { draft, onProfile }

  useEffect(() => {
    dirty.current = false
    autosave.cancel()
    setDraft(profile)
  }, [profile, autosave])

  useEffect(() => {
    if (dirty.current && draft) autosave.schedule(draft)
  }, [draft, autosave])

  useEffect(
    () => () => {
      if (!dirty.current) return
      const { draft: last, onProfile: handOver } = latest.current
      void autosave.flush().then(() => {
        if (last) handOver(cleanProfile(last))
      })
    },
    [autosave],
  )

  const update = (partial: Partial<Profile>) => {
    dirty.current = true
    setDraft((p) => (p ? { ...p, ...partial } : p))
  }

  /** The draft is about to be saved explicitly (« continue »): no pending autosave, nothing to hand over. */
  const beforeExplicitSave = () => autosave.cancel()
  const afterExplicitSave = () => {
    dirty.current = false
  }

  return { draft, update, saveStatus, beforeExplicitSave, afterExplicitSave }
}
