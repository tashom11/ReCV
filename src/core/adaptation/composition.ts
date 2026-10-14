import type { Profile, TailoredCv } from '../schemas'
import { eclaterCompetences, estCompetenceCourte, estSavoirEtre, formaterCompetence, sansDoublons } from './competences'

/** Décisions de l'utilisateur sur l'écran de vérification. */
export interface ChoixComposition {
  titre: boolean
  accroche: boolean
  /** Vrai : sélection adaptée ; faux : toutes les compétences du profil, dans leur ordre d'origine. */
  competences: boolean
  /** Une entrée par expérience du CV adapté : points adaptés (true) ou réalisations d'origine (false). */
  experiences: boolean[]
  /** Éléments écartés que l'utilisateur réintègre (même ordre que `adapte.ecartes`). */
  reintegrer: { experiences: boolean[]; competences: boolean[]; formations: boolean[] }
  /** Compétences demandées par l'offre que l'utilisateur déclare maîtriser (même ordre que `adapte.demandees.manquantes`). */
  ajouterDemandees: boolean[]
}

const nettoyer = (valeurs: string[]) => valeurs.map((v) => v.trim()).filter(Boolean)

/**
 * Compose le CV final selon les choix de l'utilisateur. Les faits viennent toujours du profil :
 * seuls les points des expériences conservées (éditables) diffèrent des réalisations d'origine.
 * `points` : points éventuellement corrigés à la main, une entrée par expérience du CV adapté.
 */
export function composerCv(
  profil: Profile,
  adapte: TailoredCv,
  choix: ChoixComposition,
  points: string[][],
): TailoredCv {
  const gardees = adapte.experiences.map((experience, i) => ({
    ...experience,
    bullets: choix.experiences[i]
      ? nettoyer(points[i] ?? experience.bullets)
      : (profil.experiences[experience.sourceIndex ?? i]?.achievements ?? experience.bullets),
  }))
  const reintegrees = adapte.excluded.experiences.filter((_, i) => choix.reintegrer.experiences[i])
  // Ordre du profil d'origine ; sans indice connu, l'élément reste à la suite.
  const experiences = [...gardees, ...reintegrees].sort(
    (a, b) => (a.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (b.sourceIndex ?? Number.MAX_SAFE_INTEGER),
  )

  // Sans sélection adaptée : toutes les compétences du profil, mais jamais ses phrases d'activités.
  const base = choix.competences ? adapte.skills : eclaterCompetences(profil.skills).filter(estCompetenceCourte)
  const competences = [
    ...base,
    ...adapte.excluded.skills.filter((c, i) => choix.reintegrer.competences[i] && !base.includes(c)),
  ]
  // Demandées par l'offre et déclarées par l'utilisateur : c'est lui qui atteste, pas le modèle. Elles rejoignent
  // les compétences clés, avec la formulation de l'offre.
  const declarees = adapte.requested.missing.filter((_, i) => choix.ajouterDemandees[i]).map(formaterCompetence)
  const sansDoublon = (liste: string[]) =>
    liste.filter((c, i, tous) => tous.findIndex((u) => u.toLowerCase() === c.toLowerCase()) === i)
  const competencesCles = sansDoublon([...adapte.keySkills, ...declarees.filter((c) => !estSavoirEtre(c))])
  // Qualités déclarées : en tête de la ligne Savoir-être.
  const qualitesDeclarees = declarees.filter(estSavoirEtre)

  const rang = (diplome: string, etablissement: string) => {
    const i = profil.education.findIndex((f) => f.degree === diplome && f.school === etablissement)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const formations = [
    ...adapte.education,
    ...adapte.excluded.education.filter((_, i) => choix.reintegrer.formations[i]),
  ].sort((a, b) => rang(a.degree, a.school) - rang(b.degree, b.school))

  return {
    ...adapte,
    headline: choix.titre ? adapte.headline : (profil.headline ?? adapte.headline),
    summary: choix.accroche ? adapte.summary : (profil.summary ?? adapte.summary),
    keySkills: competencesCles,
    skills: sansDoublons([...qualitesDeclarees, ...competences]),
    experiences,
    education: formations,
    excluded: { experiences: [], skills: [], education: [] },
    requested: { evidenced: [], missing: [], requirements: {} },
  }
}

/** Choix initial : tout ce qui est adapté est accepté, tout ce qui est écarté reste écarté. */
export function choixInitial(adapte: TailoredCv): ChoixComposition {
  return {
    titre: true,
    accroche: true,
    competences: true,
    experiences: adapte.experiences.map(() => true),
    reintegrer: {
      experiences: adapte.excluded.experiences.map(() => false),
      competences: adapte.excluded.skills.map(() => false),
      formations: adapte.excluded.education.map(() => false),
    },
    // Décochées par défaut : l'utilisateur coche seulement ce qu'il sait vraiment faire (il devra le défendre
    // en entretien). Rien d'absent du profil n'entre dans le CV sans son accord.
    ajouterDemandees: adapte.requested.missing.map(() => false),
  }
}
