import type { Excluded } from '@core/schemas'
import type { CompositionChoices } from '@core/tailoring/composition'
import { texts } from '../../i18n'
import { Checkbox, Collapsible } from '../../ui'
import { replaceAt } from './useTailoredCvDraft'

/** What was left out of this CV as unrelated to the job posting: each item can be ticked to put it back. */
export function ExcludedItemsSection({
  excluded,
  reinstate,
  onReinstate,
}: {
  excluded: Excluded
  reinstate: CompositionChoices['reinstate']
  onReinstate: (partial: Partial<CompositionChoices['reinstate']>) => void
}) {
  const count = excluded.experiences.length + excluded.skills.length + excluded.education.length
  if (count === 0) return null
  return (
    <Collapsible title={texts.newCv.excluded.title} count={count} summaryLine={texts.newCv.excluded.summary}>
      <fieldset>
        <legend className="text-petit text-aide">{texts.newCv.excluded.legend}</legend>
        {excluded.experiences.map((e, i) => (
          <Checkbox
            key={`${e.sourceIndex ?? i}-${e.position}-${e.company}`}
            label={`${e.position} — ${e.company}`}
            hint={e.dateRange}
            check={reinstate.experiences[i] ?? false}
            onChange={(v) => onReinstate({ experiences: replaceAt(reinstate.experiences, i, v) })}
          />
        ))}
        {excluded.education.map((f, i) => (
          <Checkbox
            key={`${f.degree}-${f.school}`}
            label={`${f.degree} — ${f.school}`}
            check={reinstate.education[i] ?? false}
            onChange={(v) => onReinstate({ education: replaceAt(reinstate.education, i, v) })}
          />
        ))}
        {excluded.skills.map((skill, i) => (
          <Checkbox
            key={skill}
            label={skill}
            check={reinstate.skills[i] ?? false}
            onChange={(v) => onReinstate({ skills: replaceAt(reinstate.skills, i, v) })}
          />
        ))}
      </fieldset>
    </Collapsible>
  )
}
