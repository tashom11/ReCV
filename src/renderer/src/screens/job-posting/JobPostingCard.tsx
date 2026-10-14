import type { JobPostingPreview } from '@core/api'
import type { JobPosting } from '@core/schemas'
import { type ReactNode, useState } from 'react'
import { texts } from '../../i18n'
import { Button, Icon, Pill, TextField } from '../../ui'
import { goodToKnow } from './goodToKnow'

/**
 * Confirmation card of what was read: title, company, location, contract, what the employer is looking for, and the
 * full text behind « Voir le texte complet », where it can be corrected and read again.
 */
export function JobPostingCard({
  jobPosting,
  preview,
  onReread,
  busy,
  loading,
}: {
  jobPosting: JobPosting
  preview: JobPostingPreview
  /** Reads a corrected version of the job posting again. */
  onReread: (corrected: JobPosting) => void
  busy: boolean
  /** Progress shown while the corrected text is read again. */
  loading: ReactNode
}) {
  const [correction, setCorrection] = useState<JobPosting | null>(null)
  const note = goodToKnow(preview.requirements)
  const details = [jobPosting.company, jobPosting.location, preview.contractType].filter((v) => v && v.trim() !== '')
  return (
    <article className="rounded-panneau border border-trait bg-surface shadow-panneau">
      <div className="space-y-6 p-8">
        <header className="flex items-start gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-carte bg-marque-pale text-marque">
            <Icon name="briefcase" size={28} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[1.75rem] leading-tight font-bold text-encre">{jobPosting.jobTitle}</h2>
            {details.length > 0 && (
              <p className="mt-1.5 flex flex-wrap gap-x-5 text-intro text-encre-douce">
                {details.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </p>
            )}
          </div>
        </header>

        {preview.soughtSkills.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-corps font-bold text-encre">{texts.jobPosting.card.sought}</h3>
            <ul className="flex flex-wrap gap-2.5">
              {preview.soughtSkills.map((term) => (
                <li key={term}>
                  <Pill>{term}</Pill>
                </li>
              ))}
            </ul>
          </section>
        )}

        {note && (
          <p className="flex items-start gap-3 rounded-carte bg-info-fond px-5 py-4 text-info">
            <Icon name="info" className="mt-0.5" />
            <span>
              <strong>{texts.jobPosting.card.goodToKnow}</strong> {note}
            </span>
          </p>
        )}
      </div>

      <details className="group border-t border-trait">
        <summary className="flex min-h-16 items-center gap-3 rounded-b-panneau px-8 font-bold text-marque">
          <Icon name="eye" />
          <span className="flex-1">{texts.jobPosting.card.fullText}</span>
          <Icon name="chevron-down" className="transition-transform duration-(--duree) group-open:rotate-180" />
        </summary>
        <div className="space-y-4 px-8 pb-8">
          {correction ? (
            <>
              <TextField
                label={texts.jobPosting.card.jobTitleLabel}
                value={correction.jobTitle}
                onChange={(v) => setCorrection({ ...correction, jobTitle: v })}
              />
              <TextField
                label={texts.jobPosting.card.textLabel}
                multiline
                rows={12}
                value={correction.rawText}
                onChange={(v) => setCorrection({ ...correction, rawText: v })}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => onReread(correction)}
                  busy={busy}
                  disabled={!correction.jobTitle.trim() || !correction.rawText.trim()}
                >
                  {texts.jobPosting.card.reread}
                </Button>
                <Button variant="secondary" onClick={() => setCorrection(null)} disabled={busy}>
                  {texts.jobPosting.card.keep}
                </Button>
              </div>
              {loading}
            </>
          ) : (
            <>
              <p className="max-h-80 overflow-y-auto rounded-champ bg-papier p-4 whitespace-pre-wrap text-encre">
                {jobPosting.rawText}
              </p>
              <Button variant="secondary" icon="pencil" onClick={() => setCorrection(jobPosting)}>
                {texts.jobPosting.card.correct}
              </Button>
            </>
          )}
        </div>
      </details>
    </article>
  )
}
