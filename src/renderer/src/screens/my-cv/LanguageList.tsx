import type { Language } from '@core/schemas'
import { Button, Collapsible, Select, TextField } from '../../ui'
import { emptyLanguage, languagesSummary, levelOptions, replaceAt } from './profileDraft'
import { useUndoableRemove } from './useUndoableRemove'

const describe = (language: Language) => language.name.trim() || 'Langue sans nom'

/** Languages of the profile, with a CEFR level; removable (with undo) and addable. */
export function LanguageList({
  languages,
  onChange,
}: {
  languages: Language[]
  onChange: (languages: Language[]) => void
}) {
  const { remove, notice } = useUndoableRemove(languages, onChange, describe)
  return (
    <Collapsible title="Langues" count={languages.length} summaryLine={languagesSummary(languages)}>
      {languages.map((language, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
        <div key={i} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <TextField
            label="Langue"
            value={language.name}
            onChange={(v) => onChange(replaceAt(languages, i, { ...language, name: v }))}
          />
          <Select
            label="Niveau"
            value={language.level ?? ''}
            options={levelOptions(language.level ?? '')}
            onChange={(v) => onChange(replaceAt(languages, i, { ...language, level: v }))}
          />
          {/* Every row has a « Retirer » button: its accessible name says which language it removes. */}
          <Button variant="danger" onClick={() => remove(i)} ariaLabel={`Retirer la langue « ${describe(language)} »`}>
            Retirer
          </Button>
        </div>
      ))}
      {notice}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...languages, emptyLanguage()])}>
        Ajouter une langue
      </Button>
    </Collapsible>
  )
}
