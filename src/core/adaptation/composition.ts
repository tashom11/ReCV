import type { CvAdapte, Profil } from '../schemas'
import { eclaterCompetences, estCompetenceCourte, formaterCompetence } from './competences'

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
export function composerCv(profil: Profil, adapte: CvAdapte, choix: ChoixComposition, points: string[][]): CvAdapte {
  const gardees = adapte.experiences.map((experience, i) => ({
    ...experience,
    points: choix.experiences[i]
      ? nettoyer(points[i] ?? experience.points)
      : (profil.experiences[experience.indice ?? i]?.realisations ?? experience.points),
  }))
  const reintegrees = adapte.ecartes.experiences.filter((_, i) => choix.reintegrer.experiences[i])
  // Ordre du profil d'origine ; sans indice connu, l'élément reste à la suite.
  const experiences = [...gardees, ...reintegrees].sort(
    (a, b) => (a.indice ?? Number.MAX_SAFE_INTEGER) - (b.indice ?? Number.MAX_SAFE_INTEGER),
  )

  // Sans sélection adaptée : toutes les compétences du profil, mais jamais ses phrases d'activités.
  const base = choix.competences
    ? adapte.competences
    : eclaterCompetences(profil.competences).filter(estCompetenceCourte)
  const competences = [
    ...base,
    ...adapte.ecartes.competences.filter((c, i) => choix.reintegrer.competences[i] && !base.includes(c)),
  ]
  // Demandées par l'offre et déclarées par l'utilisateur : c'est lui qui atteste, pas le modèle. Elles rejoignent
  // les compétences clés, avec la formulation de l'offre.
  const declarees = adapte.demandees.manquantes.filter((_, i) => choix.ajouterDemandees[i]).map(formaterCompetence)
  const competencesCles = [...adapte.competencesCles, ...declarees].filter(
    (c, i, tous) => tous.findIndex((u) => u.toLowerCase() === c.toLowerCase()) === i,
  )

  const rang = (diplome: string, etablissement: string) => {
    const i = profil.formations.findIndex((f) => f.diplome === diplome && f.etablissement === etablissement)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const formations = [
    ...adapte.formations,
    ...adapte.ecartes.formations.filter((_, i) => choix.reintegrer.formations[i]),
  ].sort((a, b) => rang(a.diplome, a.etablissement) - rang(b.diplome, b.etablissement))

  return {
    ...adapte,
    titre: choix.titre ? adapte.titre : (profil.titrePoste ?? adapte.titre),
    accroche: choix.accroche ? adapte.accroche : (profil.accroche ?? adapte.accroche),
    competencesCles,
    competences,
    experiences,
    formations,
    ecartes: { experiences: [], competences: [], formations: [] },
    demandees: { attestees: [], manquantes: [] },
  }
}

/** Choix initial : tout ce qui est adapté est accepté, tout ce qui est écarté reste écarté. */
export function choixInitial(adapte: CvAdapte): ChoixComposition {
  return {
    titre: true,
    accroche: true,
    competences: true,
    experiences: adapte.experiences.map(() => true),
    reintegrer: {
      experiences: adapte.ecartes.experiences.map(() => false),
      competences: adapte.ecartes.competences.map(() => false),
      formations: adapte.ecartes.formations.map(() => false),
    },
    // Cochées par défaut pour que le CV colle à l'offre ; l'utilisateur décoche ce qu'il ne maîtrise pas.
    ajouterDemandees: adapte.demandees.manquantes.map(() => true),
  }
}
