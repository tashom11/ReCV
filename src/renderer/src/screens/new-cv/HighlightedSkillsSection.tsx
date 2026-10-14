import { formatSkill } from '@core/tailoring/skills'
import { Checkbox, Collapsible } from '../../ui'

/**
 * Skills put forward: those of the job posting already in the CV (ticked, can be removed), and those requested but
 * absent (unticked: the user ticks only what they really master, they may be asked about it in an interview).
 */
export function HighlightedSkillsSection({
  present,
  isPresentKept,
  onTogglePresent,
  missing,
  isMissingAdded,
  onToggleMissing,
}: {
  present: string[]
  isPresentKept: (term: string) => boolean
  onTogglePresent: (term: string, kept: boolean) => void
  missing: string[]
  isMissingAdded: (index: number) => boolean
  onToggleMissing: (index: number, added: boolean) => void
}) {
  if (present.length === 0 && missing.length === 0) return null
  return (
    <Collapsible title="Compétences mises en avant" open>
      {present.length > 0 && (
        <fieldset>
          <legend className="text-libelle font-bold text-marque">Déjà dans votre CV · placées en premier</legend>
          {present.map((term) => (
            <Checkbox key={term} label={term} check={isPresentKept(term)} onChange={(v) => onTogglePresent(term, v)} />
          ))}
        </fieldset>
      )}
      {missing.length > 0 && (
        <fieldset className="rounded-bouton bg-alerte-fond p-4">
          <legend className="float-left w-full text-libelle font-bold text-alerte">
            Demandées par l’annonce, absentes de votre CV
          </legend>
          <p className="clear-both pt-1.5 pb-1 text-petit text-alerte">
            Cochez seulement ce que vous savez vraiment faire : on pourra vous interroger dessus en entretien.
          </p>
          {missing.map((term, i) => (
            <Checkbox
              key={term}
              label={formatSkill(term)}
              check={isMissingAdded(i)}
              onChange={(v) => onToggleMissing(i, v)}
            />
          ))}
        </fieldset>
      )}
    </Collapsible>
  )
}
