import type { TailoredExperience } from '@core/schemas'
import { texts } from '../../i18n'
import { Checkbox, Collapsible } from '../../ui'
import { replaceAt } from './useTailoredCvDraft'

/** Experiences kept in this CV: each can be unticked to leave it out of this CV only (the profile is untouched). */
export function KeptExperiencesSection({
  experiences,
  kept,
  onKept,
}: {
  experiences: TailoredExperience[]
  kept: boolean[]
  onKept: (kept: boolean[]) => void
}) {
  if (experiences.length === 0) return null
  return (
    <Collapsible
      title={texts.newCv.keptExperiences.title}
      count={experiences.length}
      summaryLine={texts.newCv.keptExperiences.summary}
    >
      <fieldset>
        <legend className="text-petit text-aide">{texts.newCv.keptExperiences.legend}</legend>
        {experiences.map((e, i) => (
          <Checkbox
            key={`${e.sourceIndex ?? i}-${e.position}-${e.company}`}
            label={`${e.position} — ${e.company}`}
            hint={e.dateRange}
            check={kept[i] ?? true}
            onChange={(v) => onKept(replaceAt(kept, i, v))}
          />
        ))}
      </fieldset>
    </Collapsible>
  )
}
