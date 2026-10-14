import type { Profile, TailoredCv } from '../schemas'
import { formatSkill, isShortSkill, isSoftSkill, splitSkills, withoutDuplicates } from './skills'

/** Décisions de l'utilisateur sur l'écran de vérification. */
export interface CompositionChoices {
  title: boolean
  summary: boolean
  /** Vrai : sélection adaptée ; faux : toutes les compétences du profil, dans leur ordre d'origine. */
  skills: boolean
  /** Une entrée par expérience du CV adapté : points adaptés (true) ou réalisations d'origine (false). */
  experiences: boolean[]
  /** Éléments écartés que l'utilisateur réintègre (même ordre que `adapte.ecartes`). */
  reinstate: { experiences: boolean[]; skills: boolean[]; education: boolean[] }
  /** Compétences demandées par l'offre que l'utilisateur déclare maîtriser (même ordre que `adapte.demandees.manquantes`). */
  addRequested: boolean[]
}

const clean = (values: string[]) => values.map((v) => v.trim()).filter(Boolean)

/**
 * Compose le CV final selon les choix de l'utilisateur. Les faits viennent toujours du profil :
 * seuls les points des expériences conservées (éditables) diffèrent des réalisations d'origine.
 * `points` : points éventuellement corrigés à la main, une entrée par expérience du CV adapté.
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
  // Ordre du profil d'origine ; sans indice connu, l'élément reste à la suite.
  const experiences = [...kept, ...reinstated].sort(
    (a, b) => (a.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (b.sourceIndex ?? Number.MAX_SAFE_INTEGER),
  )

  // Sans sélection adaptée : toutes les compétences du profil, mais jamais ses phrases d'activités.
  const base = choice.skills ? tailored.skills : splitSkills(profile.skills).filter(isShortSkill)
  const skills = [
    ...base,
    ...tailored.excluded.skills.filter((c, i) => choice.reinstate.skills[i] && !base.includes(c)),
  ]
  // Demandées par l'offre et déclarées par l'utilisateur : c'est lui qui atteste, pas le modèle. Elles rejoignent
  // les compétences clés, avec la formulation de l'offre.
  const declared = tailored.requested.missing.filter((_, i) => choice.addRequested[i]).map(formatSkill)
  const dedupeCaseInsensitive = (list: string[]) =>
    list.filter((c, i, all) => all.findIndex((u) => u.toLowerCase() === c.toLowerCase()) === i)
  const keySkills = dedupeCaseInsensitive([...tailored.keySkills, ...declared.filter((c) => !isSoftSkill(c))])
  // Qualités déclarées : en tête de la ligne Savoir-être.
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

/** Choix initial : tout ce qui est adapté est accepté, tout ce qui est écarté reste écarté. */
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
    // Décochées par défaut : l'utilisateur coche seulement ce qu'il sait vraiment faire (il devra le défendre
    // en entretien). Rien d'absent du profil n'entre dans le CV sans son accord.
    addRequested: tailored.requested.missing.map(() => false),
  }
}
