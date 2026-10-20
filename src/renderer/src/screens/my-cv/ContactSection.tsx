import { suggestPlaces } from '@core/places'
import type { Profile } from '@core/schemas'
import { texts } from '../../i18n'
import { Alert, Collapsible, ComboField, TextField } from '../../ui'

/** Contact details. */
export function ContactSection({ draft, update }: { draft: Profile; update: (partial: Partial<Profile>) => void }) {
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
        <ComboField
          label={words.location}
          autoComplete="address-level2"
          placeholder={words.locationPlaceholder}
          value={draft.location ?? ''}
          onChange={(v) => update({ location: v })}
          getSuggestions={async (typed) =>
            (await suggestPlaces(typed)).map((place) => ({
              value: place.value,
              detail: place.kind === 'department' ? words.department : place.code,
            }))
          }
        />
        <TextField
          label={words.links}
          value={draft.links.join(', ')}
          placeholder={words.linksPlaceholder}
          onChange={(v) => update({ links: v.split(/,\s*/) })}
        />
      </div>
    </Collapsible>
  )
}
