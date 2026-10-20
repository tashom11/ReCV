import type { Profile } from '@core/schemas'
import { countOf, initials } from '../../flow'
import { texts } from '../../i18n'
import { Button, Icon, Pill } from '../../ui'
import { skillCount } from './profileDraft'

/** Dark card at the top of step ①: what was understood, at a glance, and the way to use another CV. */
export function ProfileSummaryCard({
  draft,
  fileName,
  importing,
  created = false,
  onImport,
}: {
  draft: Profile
  /** Name of the imported file, if known. */
  fileName: string | null
  importing: boolean
  /** The CV was started from scratch, not read from a file. */
  created?: boolean
  onImport: () => void
}) {
  const words = texts.myCv.summaryCard
  const name = (draft.fullName ?? '').trim()
  const subtitle = [draft.headline, draft.location].filter((v) => v && v.trim() !== '').join(' · ')
  const counts = [
    countOf(draft.experiences.length, ...words.counts.experiences),
    countOf(draft.education.length, ...words.counts.education),
    countOf(skillCount(draft.skills), ...words.counts.skills),
    countOf(draft.languages.length, ...words.counts.languages),
  ]
  return (
    <section className="sur-sombre space-y-5 rounded-panneau bg-encre p-7 text-white shadow-panneau">
      <p className="flex items-center gap-2 font-bold text-accent">
        <Icon name="check-circle" />
        {created ? words.created : words.read}
      </p>
      <div className="flex items-center gap-5">
        {draft.photo ? (
          <img src={draft.photo} alt="" className="size-[72px] rounded-full border-2 border-accent object-cover" />
        ) : (
          <span
            className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-2 border-accent bg-white/10 font-titre text-2xl font-bold"
            aria-hidden="true"
          >
            {initials(name) || '?'}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="break-words font-titre text-[1.75rem] leading-tight font-bold">{name || words.untitled}</h1>
          {subtitle && <p className="break-words text-intro text-white/85">{subtitle}</p>}
        </div>
      </div>
      <ul className="flex flex-wrap gap-2">
        {counts.map((c) => (
          <li key={c.name}>
            <Pill variant="on-dark">
              <strong>{c.count}</strong> {c.name}
            </Pill>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5">
        <p className="flex min-w-0 items-center gap-2.5 text-white/90">
          <Icon name="file" size={18} />
          <span className="break-all">{created ? words.createdNote : (fileName ?? words.savedCv)}</span>
        </p>
        <Button variant="on-dark" onClick={onImport} busy={importing}>
          {created ? words.importInstead : words.otherCv}
        </Button>
      </div>
    </section>
  )
}
