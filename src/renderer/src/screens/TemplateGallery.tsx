import { CV_TEMPLATES, type TemplateId } from '@core/export/templates'
import { useRef, useState } from 'react'
import { Spinner, TemplateThumbnail } from '../ui'
import type { Previews } from './template-gallery/usePreviews'
import { useScaleToWidth } from './template-gallery/useScaleToWidth'

// A4 page size in CSS pixels (96 dpi): the CV is rendered at this size then scaled down to the available width.
const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123

/** A4 page scaled to the width of its container: the CV HTML is shown in an isolated frame, without scripts. */
function ScaledPage({ html, title }: { html: string; title: string }) {
  const container = useRef<HTMLDivElement>(null)
  const scale = useScaleToWidth(container, PAGE_WIDTH, { initial: 0.1 })

  return (
    <div
      ref={container}
      className="aspect-[794/1123] w-full overflow-hidden rounded-[4px] border border-trait bg-white"
    >
      <iframe
        title={title}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none origin-top-left border-0"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})` }}
      />
    </div>
  )
}

/** Layout choice with thumbnails: each shows the real CV in that template. */
export function TemplateStrip({
  previews,
  value,
  onChange,
}: {
  previews: Previews
  value: TemplateId
  onChange: (id: TemplateId) => void
}) {
  // Radio group: arrows move the choice (and the focus) to the previous or next template.
  const current = CV_TEMPLATES.findIndex((m) => m.id === value)
  const choose = (index: number) => {
    const next = CV_TEMPLATES[(index + CV_TEMPLATES.length) % CV_TEMPLATES.length]
    if (!next) return
    onChange(next.id)
    document.getElementById(`template-${next.id}`)?.focus()
  }
  const keys: Record<string, () => void> = {
    ArrowRight: () => choose(current + 1),
    ArrowDown: () => choose(current + 1),
    ArrowLeft: () => choose(current - 1),
    ArrowUp: () => choose(current - 1),
  }
  return (
    <div>
      <p id="template-label" className="pb-2.5 text-corps font-bold text-encre">
        Mise en page
      </p>
      <div
        role="radiogroup"
        aria-labelledby="template-label"
        className="flex flex-wrap gap-3"
        onKeyDown={(e) => {
          const action = keys[e.key]
          if (!action) return
          e.preventDefault()
          action()
        }}
      >
        {CV_TEMPLATES.map((m) => {
          const html = previews[m.id]?.html
          return (
            <TemplateThumbnail
              key={m.id}
              id={`template-${m.id}`}
              name={m.name}
              chosen={m.id === value}
              onChoose={() => onChange(m.id)}
            >
              {html ? (
                <ScaledPage html={html} title={`Aperçu de la mise en page ${m.name}`} />
              ) : (
                <span className="flex aspect-[794/1123] items-center justify-center rounded-[4px] border border-trait bg-white text-trait-fort">
                  {previews[m.id]?.error ? <span className="text-petit text-aide">—</span> : <Spinner size={18} />}
                </span>
              )}
            </TemplateThumbnail>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The CV in large, as it will be downloaded. The frame is isolated and without scripts; `allow-same-origin` is only
 * used to measure the content height to count the pages.
 */
export function LargePreview({
  html,
  error,
  templateName,
  onPages,
}: {
  html?: string
  error?: string
  templateName: string
  onPages: (pages: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const scale = useScaleToWidth(container, PAGE_WIDTH, { initial: 0.8, max: 1 })
  const [pages, setPages] = useState(1)

  const height = pages * PAGE_HEIGHT

  return (
    <section aria-label="Aperçu de votre CV" className="rounded-panneau bg-creux p-6 lg:p-8">
      <div ref={container} className="mx-auto w-full max-w-[660px]">
        {html ? (
          <div className="overflow-hidden bg-white shadow-panneau" style={{ height: height * scale }}>
            <iframe
              title={`Votre CV, mise en page ${templateName}`}
              srcDoc={html}
              sandbox="allow-same-origin"
              className="origin-top-left border-0"
              style={{ width: PAGE_WIDTH, height: height, transform: `scale(${scale})` }}
              onLoad={(e) => {
                // The body height is the content height, whatever the frame height.
                const content = e.currentTarget.contentDocument?.body.scrollHeight ?? PAGE_HEIGHT
                const count = Math.max(1, Math.ceil((content - 8) / PAGE_HEIGHT))
                setPages(count)
                onPages(count)
              }}
            />
          </div>
        ) : (
          <div className="flex aspect-[794/1123] flex-col items-center justify-center gap-3 bg-white text-encre-douce shadow-panneau">
            {error ? (
              <p className="max-w-xs px-6 text-center">
                L’aperçu n’a pas pu s’afficher. Vous pouvez quand même télécharger votre CV.
              </p>
            ) : (
              <>
                <span className="text-marque">
                  <Spinner size={28} />
                </span>
                <p role="status">Nous mettons votre CV en page…</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
