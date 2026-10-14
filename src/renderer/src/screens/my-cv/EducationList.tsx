import type { Education } from '@core/schemas'
import { texts } from '../../i18n'
import { Button, Collapsible, TextField } from '../../ui'
import { educationSummary, emptyEducation, replaceAt } from './profileDraft'
import { useUndoableRemove } from './useUndoableRemove'

const words = texts.myCv.education
const describe = (education: Education) => education.degree.trim() || words.untitled

/** Education of the profile: one fieldset each, removable (with undo) and addable. */
export function EducationList({
  education,
  onChange,
}: {
  education: Education[]
  onChange: (education: Education[]) => void
}) {
  const { remove, notice } = useUndoableRemove(education, onChange, describe)
  return (
    <Collapsible title={words.title} count={education.length} summaryLine={educationSummary(education)}>
      {education.map((entry, i) => {
        const updateEducation = (partial: Partial<Education>) =>
          onChange(replaceAt(education, i, { ...entry, ...partial }))
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
          <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
            <legend className="px-2 text-libelle font-bold text-encre-douce">
              {entry.degree.trim() || words.numbered(i + 1)}
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label={words.degree} value={entry.degree} onChange={(v) => updateEducation({ degree: v })} />
              <TextField label={words.school} value={entry.school} onChange={(v) => updateEducation({ school: v })} />
              <TextField
                label={words.year}
                value={entry.dateRange ?? ''}
                onChange={(v) => updateEducation({ dateRange: v })}
              />
            </div>
            <Button
              variant="danger"
              size="small"
              onClick={() => remove(i)}
              ariaLabel={words.removeLabel(describe(entry))}
            >
              {words.remove}
            </Button>
          </fieldset>
        )
      })}
      {notice}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...education, emptyEducation()])}>
        {words.add}
      </Button>
    </Collapsible>
  )
}
