import { CV_TEMPLATES, type TemplateId } from '@core/export/templates'
import type { TailoredCv } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'

export type Previews = Partial<Record<TemplateId, { html?: string; error?: string }>>

const REFRESH_DELAY_MS = 400

/**
 * Previews of the CV in every layout (the real rendering, photo included), recomputed shortly after the last change.
 * The old previews stay visible during the recomputation: nothing flickers.
 */
export function usePreviews(cv: TailoredCv): { previews: Previews; busy: boolean } {
  const [previews, setPreviews] = useState<Previews>({})
  const [busy, setBusy] = useState(true)
  // Generation number: a more recent generation makes the answers of the previous ones obsolete.
  const generation = useRef(0)

  useEffect(() => {
    const number = ++generation.current
    setBusy(true)
    const timer = setTimeout(async () => {
      for (const template of CV_TEMPLATES) {
        let preview: { html?: string; error?: string }
        try {
          preview = { html: await window.api.templateHtml(cv, template.id) }
        } catch (e) {
          preview = { error: e instanceof Error ? e.message : String(e) }
        }
        if (number !== generation.current) return
        setPreviews((current) => ({ ...current, [template.id]: preview }))
      }
      setBusy(false)
    }, REFRESH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [cv])

  return { previews, busy }
}
