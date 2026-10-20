import type { Profile } from '@core/schemas'
import { texts } from '../../i18n'
import { Alert, Button, Collapsible, Loading, TextField } from '../../ui'

/**
 * The presentation sentence at the top of the CV, which the model can suggest. It comes last in the form: the
 * suggestion is built from the qualities listed above, so it is of no use before they are filled in.
 */
export function PresentationSection({
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
  const words = texts.myCv.presentation
  return (
    <Collapsible title={words.title} count={words.optional} summaryLine={words.summary}>
      <TextField
        label={words.label}
        multiline
        rows={3}
        value={draft.summary ?? ''}
        onChange={(v) => update({ summary: v })}
        hint={words.hint}
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
