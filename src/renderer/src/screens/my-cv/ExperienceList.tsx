import type { Experience } from '@core/schemas'
import { Button, Collapsible, TextField } from '../../ui'
import { emptyExperience, experiencesSummary, replaceAt, toLines } from './profileDraft'
import { useUndoableRemove } from './useUndoableRemove'

const describe = (experience: Experience) => experience.position.trim() || 'Expérience sans intitulé'

/** Experiences of the profile: one fieldset each, removable (with undo) and addable. */
export function ExperienceList({
  experiences,
  onChange,
}: {
  experiences: Experience[]
  onChange: (experiences: Experience[]) => void
}) {
  const { remove, notice } = useUndoableRemove(experiences, onChange, describe)
  return (
    <Collapsible title="Vos expériences" count={experiences.length} summaryLine={experiencesSummary(experiences)}>
      {experiences.map((experience, i) => {
        const updateExperience = (partial: Partial<Experience>) =>
          onChange(replaceAt(experiences, i, { ...experience, ...partial }))
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: editable list without a stable id
          <fieldset key={i} className="space-y-4 rounded-bouton border border-trait p-4">
            <legend className="px-2 text-libelle font-bold text-encre-douce">
              {experience.position.trim() || `Expérience ${i + 1}`}
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Poste"
                value={experience.position}
                onChange={(v) => updateExperience({ position: v })}
              />
              <TextField
                label="Entreprise"
                value={experience.company}
                onChange={(v) => updateExperience({ company: v })}
              />
              <TextField
                label="Dates"
                value={experience.dateRange ?? ''}
                placeholder="Ex. : 2019 – 2024"
                onChange={(v) => updateExperience({ dateRange: v })}
              />
              <TextField
                label="Ville"
                value={experience.location ?? ''}
                onChange={(v) => updateExperience({ location: v })}
              />
            </div>
            <TextField
              label="En une phrase (facultatif)"
              multiline
              rows={2}
              value={experience.description ?? ''}
              onChange={(v) => updateExperience({ description: v })}
            />
            <TextField
              label="Ce que vous avez fait (une idée par ligne)"
              multiline
              rows={4}
              value={experience.achievements.join('\n')}
              onChange={(v) => updateExperience({ achievements: toLines(v) })}
            />
            <Button
              variant="danger"
              size="small"
              onClick={() => remove(i)}
              ariaLabel={`Retirer l’expérience « ${describe(experience)} »`}
            >
              Retirer cette expérience
            </Button>
          </fieldset>
        )
      })}
      {notice}
      <Button variant="secondary" icon="plus" onClick={() => onChange([...experiences, emptyExperience()])}>
        Ajouter une expérience
      </Button>
    </Collapsible>
  )
}
