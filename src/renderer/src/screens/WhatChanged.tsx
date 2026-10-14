import type { Profile, TailoredCv } from '@core/schemas'
import type { CompositionChoices } from '@core/tailoring/composition'
import type { ReactNode } from 'react'
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
          <p className="text-petit font-bold text-encre-douce">Dans votre CV de départ</p>
          <div className="text-corps text-encre">{before}</div>
        </div>
        <div className="space-y-2 rounded-bouton bg-marque-pale p-4">
          <p className="text-petit font-bold text-marque">Dans ce nouveau CV</p>
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
  title,
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
  title: string
  onHeadline: (title: string) => void
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
        <h2 className="font-titre text-titre-section font-bold">Ce qui a changé</h2>
        <p className="text-corps text-encre-douce">
          Vos postes, dates et formations ne changent pas : nous choisissons et réordonnons ce qui vient de votre CV.
        </p>
      </header>

      <Comparison
        title="Titre du CV"
        before={<p>{profile.headline || '—'}</p>}
        after={<TextField label="Titre adapté à l’annonce" value={title} onChange={onHeadline} />}
        keep={
          <Checkbox
            label="Utiliser le titre adapté"
            check={choices.title}
            onChange={(v) => onChoices({ ...choices, title: v })}
          />
        }
      />

      <Comparison
        title="Phrase de présentation"
        before={<p className="whitespace-pre-wrap">{profile.summary || '—'}</p>}
        after={
          <TextField label="Phrase adaptée à l’annonce" multiline toLines={4} value={summary} onChange={onSummary} />
        }
        keep={
          <Checkbox
            label="Utiliser la phrase adaptée"
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
                label="Ce que vous avez fait (une idée par ligne)"
                multiline
                toLines={Math.max(4, (bullets[i]?.length ?? 0) + 1)}
                value={(bullets[i] ?? []).join('\n')}
                onChange={(v) => onBullets(bullets.map((x, j) => (j === i ? toLines(v) : x)))}
              />
            }
            keep={
              <Checkbox
                label="Utiliser les phrases choisies pour cette annonce"
                hint="Décochée : toutes vos phrases de départ sont reprises, dans leur ordre."
                check={choices.experiences[i] ?? true}
                onChange={(v) => onChoices({ ...choices, experiences: replaceAt(choices.experiences, i, v) })}
              />
            }
          />
        )
      })}

      <Comparison
        title="Compétences"
        before={<p>{profile.skills.join(', ') || '—'}</p>}
        after={<p className="text-corps text-encre">{finalSkills.join(', ') || '—'}</p>}
        keep={
          <Checkbox
            label="Utiliser la sélection adaptée"
            hint="Les compétences utiles pour cette annonce, celles qu’elle demande en premier."
            check={choices.skills}
            onChange={(v) => onChoices({ ...choices, skills: v })}
          />
        }
      />
    </div>
  )
}
