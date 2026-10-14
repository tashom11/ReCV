import type { ReactNode } from 'react'
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
        label="Façon de donner l’annonce"
        panelId={PANEL_ID}
        value={mode}
        onChange={onMode}
        disabled={busy}
        tabs={[
          { id: 'link', label: 'Coller un lien', icon: 'link' },
          { id: 'text', label: 'Coller le texte', icon: 'clipboard' },
        ]}
      />
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(PANEL_ID, mode)} className="space-y-5">
        {mode === 'link' ? (
          <TextField
            label="Adresse de l’annonce"
            type="url"
            large
            value={url}
            onChange={onUrl}
            placeholder="Collez ici l’adresse (elle commence par https://)"
            hint="Astuce : dans votre navigateur, cliquez sur la barre d’adresse puis faites Ctrl + C pour copier."
          />
        ) : (
          <TextField
            label="Texte de l’annonce"
            multiline
            rows={10}
            value={text}
            onChange={onText}
            placeholder="Collez ici tout le texte de l’annonce"
            hint="Astuce : sur la page de l’annonce, sélectionnez le texte avec la souris, faites Ctrl + C, puis Ctrl + V ici."
          />
        )}
        <Button size="large" onClick={onRead} busy={busy} disabled={mode === 'link' ? !url.trim() : !text.trim()}>
          Lire l’annonce
        </Button>
        {loading}
      </div>
    </section>
  )
}
