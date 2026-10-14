import type { Profile, TailoredCv } from '../schemas'
import { formatSkill, isShortSkill, isSoftSkill, splitSkills, withoutDuplicates } from './skills'

/** User decisions on the review screen. */
export interface CompositionChoices {
  title: boolean
  summary: boolean
  /** True: tailored selection; false: all the profile skills, in their original order. */
  skills: boolean
  /** One entry per experience of the tailored CV: tailored bullets (true) or original achievements (false). */
  experiences: boolean[]
  /** Excluded items the user reinstates (same order as `tailored.excluded`). */
  reinstate: { experiences: boolean[]; skills: boolean[]; education: boolean[] }
  /**
   * Skills requested by the job posting that the user declares to master (same order as `tailored.requested.missing`).
   */
  addRequested: boolean[]
}

const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)

/**
 * Composes the final CV according to the user's choices. Facts always come from the profile: only the bullets of
 * the kept experiences (editable) differ from the original achievements.
 * `bullets`: bullets possibly corrected by hand, one entry per experience of the tailored CV.
 */
export function composeCv(
  profile: Profile,
  tailored: TailoredCv,
  choice: CompositionChoices,
  bullets: string[][],
): TailoredCv {
  const kept = tailored.experiences.map((experience, i) => ({
    ...experience,
    bullets: choice.experiences[i]
      ? clean(bullets[i] ?? experience.bullets)
      : (profile.experiences[experience.sourceIndex ?? i]?.achievements ?? experience.bullets),
  }))
  const reinstated = tailored.excluded.experiences.filter((_, i) => choice.reinstate.experiences[i])
  // Order of the original profile; without a known index, the item stays at the end.
  const experiences = [...kept, ...reinstated].sort(
    (a, b) => (a.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (b.sourceIndex ?? Number.MAX_SAFE_INTEGER),
  )

  // Without tailored selection: all the profile skills, but never its activity sentences.
  const base = choice.skills ? tailored.skills : splitSkills(profile.skills).filter(isShortSkill)
  const skills = [
    ...base,
    ...tailored.excluded.skills.filter((c, i) => choice.reinstate.skills[i] && !base.includes(c)),
  ]
  // Requested by the job posting and declared by the user: the user vouches for them, not the model. They join the
  // key skills, worded as in the job posting.
  const declared = tailored.requested.missing.filter((_, i) => choice.addRequested[i]).map(formatSkill)
  const dedupeCaseInsensitive = (list: string[]) =>
    list.filter((c, i, all) => all.findIndex((u) => u.toLowerCase() === c.toLowerCase()) === i)
  const keySkills = dedupeCaseInsensitive([...tailored.keySkills, ...declared.filter((c) => !isSoftSkill(c))])
  // Declared qualities: at the start of the soft skills line.
  const declaredSoftSkills = declared.filter(isSoftSkill)

  const rank = (degree: string, school: string) => {
    const i = profile.education.findIndex((f) => f.degree === degree && f.school === school)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const education = [
    ...tailored.education,
    ...tailored.excluded.education.filter((_, i) => choice.reinstate.education[i]),
  ].sort((a, b) => rank(a.degree, a.school) - rank(b.degree, b.school))

  return {
    ...tailored,
    headline: choice.title ? tailored.headline : (profile.headline ?? tailored.headline),
    summary: choice.summary ? tailored.summary : (profile.summary ?? tailored.summary),
    keySkills: keySkills,
    skills: withoutDuplicates([...declaredSoftSkills, ...skills]),
    experiences,
    education: education,
    excluded: { experiences: [], skills: [], education: [] },
    requested: { evidenced: [], missing: [], requirements: {} },
  }
}

/** Initial choice: everything tailored is accepted, everything excluded stays excluded. */
export function initialChoices(tailored: TailoredCv): CompositionChoices {
  return {
    title: true,
    summary: true,
    skills: true,
    experiences: tailored.experiences.map(() => true),
    reinstate: {
      experiences: tailored.excluded.experiences.map(() => false),
      skills: tailored.excluded.skills.map(() => false),
      education: tailored.excluded.education.map(() => false),
    },
    // Unticked by default: the user only ticks what they can really do (they will have to defend it in an interview).
    // Nothing absent from the profile enters the CV without their consent.
    addRequested: tailored.requested.missing.map(() => false),
  }
}
