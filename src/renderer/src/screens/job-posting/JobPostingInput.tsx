import type { ReactNode } from 'react'
import { texts } from '../../i18n'
import { Button, SegmentedTabs, TextField } from '../../ui'
import { tabId } from '../../ui/SegmentedTabs'

export type InputMode = 'link' | 'text'

const PANEL_ID = 'job-posting-input'

/** Input of the job posting: tabs « Coller un lien » / « Coller le texte », the field, and « Lire l’annonce ». */
export function JobPostingInput({
  mode,
  onMode,
  url,
  onUrl,
  text,
  onText,
  onRead,
  busy,
  loading,
}: {
  mode: InputMode
  onMode: (mode: InputMode) => void
  url: string
  onUrl: (url: string) => void
  text: string
  onText: (text: string) => void
  onRead: () => void
  busy: boolean
  /** Progress shown while the job posting is read. */
  loading: ReactNode
}) {
  return (
    <section className="space-y-6 rounded-panneau border border-trait bg-surface p-8 shadow-carte">
      <SegmentedTabs
        label={texts.jobPosting.input.modesLabel}
        panelId={PANEL_ID}
        value={mode}
        onChange={onMode}
        disabled={busy}
        tabs={[
          { id: 'link', label: texts.jobPosting.input.link, icon: 'link' },
          { id: 'text', label: texts.jobPosting.input.text, icon: 'clipboard' },
        ]}
      />
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(PANEL_ID, mode)} className="space-y-5">
        {mode === 'link' ? (
          <TextField
            label={texts.jobPosting.input.urlLabel}
            type="url"
            large
            value={url}
            onChange={onUrl}
            placeholder={texts.jobPosting.input.urlPlaceholder}
            hint={texts.jobPosting.input.urlHint}
          />
        ) : (
          <TextField
            label={texts.jobPosting.input.textLabel}
            multiline
            rows={10}
            value={text}
            onChange={onText}
            placeholder={texts.jobPosting.input.textPlaceholder}
            hint={texts.jobPosting.input.textHint}
          />
        )}
        <Button size="large" onClick={onRead} busy={busy} disabled={mode === 'link' ? !url.trim() : !text.trim()}>
          {texts.jobPosting.input.read}
        </Button>
        {loading}
      </div>
    </section>
  )
}
