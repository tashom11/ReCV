import type { Profile, TailoredCv } from '@core/schemas'
import { type CompositionChoices, composeCv, initialChoices } from '@core/tailoring/composition'
import { formatSkill } from '@core/tailoring/skills'
import { useMemo, useState } from 'react'

const skillKey = (term: string) => formatSkill(term).toLowerCase()

export const replaceAt = <T>(list: T[], index: number, value: T) => list.map((x, i) => (i === index ? value : x))

/**
 * Adjustments of step ③ and the CV they produce. Facts always come from the profile (see `composeCv`): the user only
 * edits wording, chooses what to keep, and ticks requested skills they really master.
 */
export function useTailoredCvDraft(profile: Profile, tailored: TailoredCv) {
  const [headline, setHeadline] = useState(tailored.headline)
  const [summary, setSummary] = useState(tailored.summary)
  const [choices, setChoices] = useState<CompositionChoices>(() => initialChoices(tailored))
  const [bullets, setBullets] = useState<string[][]>(tailored.experiences.map((e) => e.bullets))
  // Skills already in the CV that the user unticks: they are only removed from this CV.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())

  // Skills requested by the job posting and really present in the tailored CV.
  const present = useMemo(() => {
    const inCv = new Set([...tailored.keySkills, ...tailored.skills].map(skillKey))
    return tailored.requested.evidenced.filter((term) => inCv.has(skillKey(term))).map(formatSkill)
  }, [tailored])

  const finalCv = useMemo(() => {
    const composed = composeCv(
      profile,
      { ...tailored, headline: headline.trim(), summary: summary.trim() },
      choices,
      bullets,
    )
    const keep = (skill: string) => !removed.has(skillKey(skill))
    return { ...composed, keySkills: composed.keySkills.filter(keep), skills: composed.skills.filter(keep) }
  }, [profile, tailored, headline, summary, choices, bullets, removed])

  const isPresentKept = (term: string) => !removed.has(skillKey(term))
  const togglePresent = (term: string, kept: boolean) =>
    setRemoved((current) => {
      const next = new Set(current)
      if (kept) next.delete(skillKey(term))
      else next.add(skillKey(term))
      return next
    })

  const updateReinstate = (partial: Partial<CompositionChoices['reinstate']>) =>
    setChoices((c) => ({ ...c, reinstate: { ...c.reinstate, ...partial } }))

  const setRequestedAdded = (index: number, added: boolean) =>
    setChoices((c) => ({ ...c, addRequested: replaceAt(c.addRequested, index, added) }))

  return {
    headline,
    setHeadline,
    summary,
    setSummary,
    choices,
    setChoices,
    bullets,
    setBullets,
    present,
    isPresentKept,
    togglePresent,
    updateReinstate,
    setRequestedAdded,
    finalCv,
  }
}
