import type { Profile, TailoredCv } from '@core/schemas'
import type { CompositionChoices } from '@core/tailoring/composition'
import type { ReactNode } from 'react'
import { texts } from '../i18n'
import { Checkbox, TextField } from '../ui'

const toLines = (text: string) => text.split('\n')
const replaceAt = <T,>(list: T[], index: number, value: T) => list.map((x, i) => (i === index ? value : x))

function Comparison({
  title,
  before,
  after,
  keep,
}: {
  title: string
  before: ReactNode
  after: ReactNode
  keep: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-carte border border-trait bg-surface p-6 shadow-carte">
      <h3 className="font-titre text-intro font-bold text-encre">{title}</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2 rounded-bouton bg-papier p-4">
          <p className="text-petit font-bold text-encre-douce">{texts.whatChanged.before}</p>
          <div className="text-corps text-encre">{before}</div>
        </div>
        <div className="space-y-2 rounded-bouton bg-marque-pale p-4">
          <p className="text-petit font-bold text-marque">{texts.whatChanged.after}</p>
          {after}
        </div>
      </div>
      {keep}
    </section>
  )
}

/**
 * « Before / after » comparison, part by part. It is an option of step ③: the experience sentences can be corrected
 * there and, for each part, the original version can be restored.
 */
export function WhatChanged({
  profile,
  tailored,
  finalCv,
  headline,
  onHeadline,
  summary,
  onSummary,
  bullets,
  onBullets,
  choices,
  onChoices,
}: {
  profile: Profile
  tailored: TailoredCv
  /** CV as it will be downloaded (composed skills). */
  finalCv: TailoredCv
  headline: string
  onHeadline: (headline: string) => void
  summary: string
  onSummary: (summary: string) => void
  bullets: string[][]
  onBullets: (bullets: string[][]) => void
  choices: CompositionChoices
  onChoices: (choices: CompositionChoices) => void
}) {
  const finalSkills = [...finalCv.keySkills, ...finalCv.skills]
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-titre text-titre-section font-bold">{texts.whatChanged.title}</h2>
        <p className="text-corps text-encre-douce">{texts.whatChanged.intro}</p>
      </header>

      <Comparison
        title={texts.whatChanged.headline.title}
        before={<p>{profile.headline || texts.whatChanged.empty}</p>}
        after={<TextField label={texts.whatChanged.headline.label} value={headline} onChange={onHeadline} />}
        keep={
          <Checkbox
            label={texts.whatChanged.headline.keep}
            check={choices.headline}
            onChange={(v) => onChoices({ ...choices, headline: v })}
          />
        }
      />

      <Comparison
        title={texts.whatChanged.summary.title}
        before={<p className="whitespace-pre-wrap">{profile.summary || texts.whatChanged.empty}</p>}
        after={
          <TextField label={texts.whatChanged.summary.label} multiline rows={4} value={summary} onChange={onSummary} />
        }
        keep={
          <Checkbox
            label={texts.whatChanged.summary.keep}
            check={choices.summary}
            onChange={(v) => onChoices({ ...choices, summary: v })}
          />
        }
      />

      {tailored.experiences.map((experience, i) => {
        const original = profile.experiences[experience.sourceIndex ?? i]
        return (
          <Comparison
            key={`${experience.sourceIndex ?? i}-${experience.position}-${experience.company}`}
            title={`${experience.position} — ${experience.company}`}
            before={
              <ul className="list-disc space-y-1 pl-5">
                {(original?.achievements ?? []).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            }
            after={
              <TextField
                label={texts.whatChanged.experience.label}
                multiline
                rows={Math.max(4, (bullets[i]?.length ?? 0) + 1)}
                value={(bullets[i] ?? []).join('\n')}
                onChange={(v) => onBullets(bullets.map((x, j) => (j === i ? toLines(v) : x)))}
              />
            }
            keep={
              <Checkbox
                label={texts.whatChanged.experience.keep}
                hint={texts.whatChanged.experience.keepHint}
                check={choices.experiences[i] ?? true}
                onChange={(v) => onChoices({ ...choices, experiences: replaceAt(choices.experiences, i, v) })}
              />
            }
          />
        )
      })}

      <Comparison
        title={texts.whatChanged.skills.title}
        before={<p>{profile.skills.join(', ') || texts.whatChanged.empty}</p>}
        after={<p className="text-corps text-encre">{finalSkills.join(', ') || texts.whatChanged.empty}</p>}
        keep={
          <Checkbox
            label={texts.whatChanged.skills.keep}
            hint={texts.whatChanged.skills.keepHint}
            check={choices.skills}
            onChange={(v) => onChoices({ ...choices, skills: v })}
          />
        }
      />
    </div>
  )
}
