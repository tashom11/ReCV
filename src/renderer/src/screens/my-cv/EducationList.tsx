import type { Education } from '@core/schemas'
import { Button, Collapsible, TextField } from '../../ui'
import { educationSummary, emptyEducation, replaceAt } from './profileDraft'
import { useUndoableRemove } from './useUndoableRemove'

const describe = (education: Education) => education.degree.trim() || 'Formation sans intitulé'

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
    <Collapsible title="Formations" count={education.length} summaryLine={educationSummary(education)}>
      {education.map((entry, i) => {
        const updateEducation = (partial: Partial<Education>) =>
          onChange(replaceAt(education, i, { ...entry, ...partial }))
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
          <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
            <legend className="px-2 text-libelle font-bold text-encre-douce">
              {entry.degree.trim() || `Formation ${i + 1}`}
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Diplôme" value={entry.degree} onChange={(v) => updateEducation({ degree: v })} />
              <TextField label="Établissement" value={entry.school} onChange={(v) => updateEducation({ school: v })} />
              <TextField
                label="Année"
                value={entry.dateRange ?? ''}
                onChange={(v) => updateEducation({ dateRange: v })}
              />
            </div>
            <Button
              variant="danger"
              size="small"
              onClick={() => remove(i)}
              ariaLabel={`Retirer la formation « ${describe(entry)} »`}
            >
              Retirer cette formation
            </Button>
          </fieldset>
        )
      })}
      {notice}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...education, emptyEducation()])}>
        Ajouter une formation
      </Button>
    </Collapsible>
  )
}
