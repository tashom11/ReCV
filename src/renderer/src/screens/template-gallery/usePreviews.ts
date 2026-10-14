import type { TemplateId } from '@core/export/templates'
import type { TailoredCv } from '@core/schemas'
import { useEffect, useRef, useState } from 'react'
import { planPreviews } from './previewPlan'

export type Previews = Partial<Record<TemplateId, { html?: string; error?: string }>>

// The large preview follows the typing closely; the thumbnails wait until the typing really stops.
const SELECTED_DELAY_MS = 400
const OTHERS_DELAY_MS = 1500

/**
 * Previews of the CV in every layout (the real rendering, photo included), recomputed after the last change: the
 * selected template first, the others later. The old previews stay visible during the recomputation: nothing flickers.
 */
export function usePreviews(cv: TailoredCv, selected: TemplateId): { previews: Previews; busy: boolean } {
  const [previews, setPreviews] = useState<Previews>({})
  const [busy, setBusy] = useState(true)
  // Generation number: a more recent generation makes the answers of the previous ones obsolete.
  const generation = useRef(0)
  // CV each preview was rendered from: an up-to-date preview is not requested again.
  const renderedFrom = useRef(new Map<TemplateId, TailoredCv>())

  useEffect(() => {
    const number = ++generation.current
    const { first, later } = planPreviews(cv, selected, renderedFrom.current)
    if (first.length + later.length === 0) {
      setBusy(false)
      return
    }
    setBusy(true)
    const render = async (templates: TemplateId[]) => {
      for (const template of templates) {
        let preview: { html?: string; error?: string }
        try {
          preview = { html: await window.api.templateHtml(cv, template) }
        } catch (e) {
          preview = { error: e instanceof Error ? e.message : String(e) }
        }
        if (number !== generation.current) return false
        renderedFrom.current.set(template, cv)
        setPreviews((current) => ({ ...current, [template]: preview }))
      }
      return true
    }
    let othersTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      if (!(await render(first))) return
      othersTimer = setTimeout(async () => {
        if (await render(later)) setBusy(false)
      }, OTHERS_DELAY_MS - SELECTED_DELAY_MS)
    }, SELECTED_DELAY_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(othersTimer)
    }
  }, [cv, selected])

  return { previews, busy }
}
