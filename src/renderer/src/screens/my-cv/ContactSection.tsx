import type { Profile } from '@core/schemas'
import { texts } from '../../i18n'
import { Alert, Button, Collapsible, Loading, TextField } from '../../ui'

/** Contact details and the profile summary sentence (which the model can suggest). */
export function ContactSection({
  draft,
  update,
  onSuggest,
  suggesting,
  suggestDisabled,
  showSuggestStep,
  feedback,
}: {
  draft: Profile
  update: (partial: Partial<Profile>) => void
  /** Asks the model for a generic summary sentence, based on qualities. */
  onSuggest: () => void
  suggesting: boolean
  suggestDisabled: boolean
  /** The main process has reported the suggestion step: it can be named. */
  showSuggestStep: boolean
  /** Shown under the field: the top of the page is out of view in the middle of the form. */
  feedback: { type: 'error' | 'success'; text: string } | null
}) {
  const words = texts.myCv.contact
  const name = (draft.fullName ?? '').trim()
  return (
    <Collapsible title={words.title} summaryLine={words.summary} open>
      {name !== '' && !/\s/.test(name) && <Alert type="warning">{words.singleWordName}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={words.fullName}
          autoComplete="name"
          value={draft.fullName ?? ''}
          onChange={(v) => update({ fullName: v })}
        />
        <TextField
          label={words.headline}
          autoComplete="organization-title"
          value={draft.headline ?? ''}
          onChange={(v) => update({ headline: v })}
        />
        <TextField
          label={words.email}
          type="email"
          autoComplete="email"
          value={draft.email ?? ''}
          onChange={(v) => update({ email: v })}
        />
        <TextField
          label={words.phone}
          type="tel"
          autoComplete="tel"
          value={draft.phone ?? ''}
          onChange={(v) => update({ phone: v })}
        />
        <TextField
          label={words.location}
          autoComplete="address-level2"
          value={draft.location ?? ''}
          onChange={(v) => update({ location: v })}
        />
        <TextField
          label={words.links}
          value={draft.links.join(', ')}
          placeholder={words.linksPlaceholder}
          onChange={(v) => update({ links: v.split(/,\s*/) })}
        />
      </div>
      <TextField
        label={words.summaryLabel}
        multiline
        rows={3}
        value={draft.summary ?? ''}
        onChange={(v) => update({ summary: v })}
        hint={words.summaryHint}
        action={
          <Button variant="outline" size="small" onClick={onSuggest} busy={suggesting} disabled={suggestDisabled}>
            {words.suggest}
          </Button>
        }
      />
      {suggesting && <Loading title={words.suggesting} step={showSuggestStep ? words.suggestingStep : undefined} />}
      {feedback && <Alert type={feedback.type}>{feedback.text}</Alert>}
    </Collapsible>
  )
}
