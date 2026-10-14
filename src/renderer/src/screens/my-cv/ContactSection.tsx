import type { Profile } from '@core/schemas'
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
  const name = (draft.fullName ?? '').trim()
  return (
    <Collapsible title="Vos coordonnées" summaryLine="Nom, métier, e-mail, téléphone, ville" open>
      {name !== '' && !/\s/.test(name) && (
        <Alert type="warning">
          Un seul mot dans « Prénom et nom » : il manque peut-être votre prénom (il apparaît en tête du CV).
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Prénom et nom"
          autoComplete="name"
          value={draft.fullName ?? ''}
          onChange={(v) => update({ fullName: v })}
        />
        <TextField
          label="Votre métier actuel"
          autoComplete="organization-title"
          value={draft.headline ?? ''}
          onChange={(v) => update({ headline: v })}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          value={draft.email ?? ''}
          onChange={(v) => update({ email: v })}
        />
        <TextField
          label="Téléphone"
          type="tel"
          autoComplete="tel"
          value={draft.phone ?? ''}
          onChange={(v) => update({ phone: v })}
        />
        <TextField
          label="Ville ou département"
          autoComplete="address-level2"
          value={draft.location ?? ''}
          onChange={(v) => update({ location: v })}
        />
        <TextField
          label="Liens (facultatif)"
          value={draft.links.join(', ')}
          placeholder="Ex. : votre page LinkedIn"
          onChange={(v) => update({ links: v.split(/,\s*/) })}
        />
      </div>
      <TextField
        label="Votre phrase de présentation"
        multiline
        rows={3}
        value={draft.summary ?? ''}
        onChange={(v) => update({ summary: v })}
        hint="Elle parle de vos qualités, pas d’un métier : elle reste valable pour toutes les annonces."
        action={
          <Button variant="outline" size="small" onClick={onSuggest} busy={suggesting} disabled={suggestDisabled}>
            Proposer une phrase
          </Button>
        }
      />
      {suggesting && (
        <Loading
          title="Nous cherchons une phrase qui vous ressemble…"
          step={showSuggestStep ? 'À partir de vos qualités' : undefined}
        />
      )}
      {feedback && <Alert type={feedback.type}>{feedback.text}</Alert>}
    </Collapsible>
  )
}
