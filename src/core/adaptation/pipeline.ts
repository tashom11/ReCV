import type { OptionsAdaptation } from '../llm/fournisseur'
import type { MoteurLLM } from '../llm/moteur'
import { nettoyerTitreOffre } from '../offre/texte'
import { type CvAdapte, cvAdapteSchema, type ExperienceAdaptee, type Offre, type Profil } from '../schemas'
import { eclaterCompetences, estCompetenceCourte, estSavoirEtre, formaterCompetence, sansDoublons } from './competences'
import { analyserCouverture, dejaListee } from './couverture'
import { analyserOffre, restreindreAnalyse } from './motsCles'
import { evaluerPertinence, indicesConserves } from './pertinence'
import { pointFidele, pointsOrigine, reecrireExperience, selectionnerPoints } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { redigerAccroche } from './titreAccroche'

const MAX_COMPETENCES_CLES = 12
const MAX_SAVOIR_ETRE = 8
const MAX_TECHNIQUES = 12

// Nombre de puces : plus détaillé pour ce qui est directement lié au poste visé.
const POINTS_PRIORITAIRES = 5
const POINTS_SECONDAIRES = 3

// Vrai si la compétence est citée dans les termes de l'offre (comparaison par mots entiers).
// Une liste d'outils (« WordPress / CMS », « HTML, CSS ») est citée dès que l'une de ses parties l'est.
// On ne découpe que sur « / » et « , » : découper « Gestion & créa. de landing pages » sur « & » ferait
// valider la compétence par le seul mot « gestion », présent dans presque toutes les offres.
function competenceCitee(competence: string, termesNormalises: string[]): boolean {
  const complete = normaliser(competence)
  const parties = [complete, ...complete.split(/\s*[/,]\s*/)].filter((partie) => partie.length >= 3)
  return parties.some((c) => termesNormalises.some((terme) => contientMot(terme, c) || contientMot(c, terme)))
}

// Calculé en code, pas par le LLM : sous-ensemble exact des compétences du profil,
// celles citées par l'offre en premier (ordre d'origine conservé sinon).
export function prioriserCompetences(competences: string[], termesOffre: string[]): string[] {
  const termes = termesOffre.map(normaliser)
  const citee = (competence: string) => competenceCitee(competence, termes)
  return [...competences.filter(citee), ...competences.filter((competence) => !citee(competence))]
}

function texteProfil(profil: Profil): string {
  return [
    profil.titrePoste ?? '',
    profil.accroche ?? '',
    ...profil.experiences.map(texteExperience),
    ...profil.competences,
    ...profil.formations.map((formation) => formation.diplome),
  ].join('\n')
}

// Source de vérification de l'accroche et du titre : tout ce que le profil affirme, dates et lieux compris.
function texteVerification(profil: Profil): string {
  return [
    texteProfil(profil),
    ...profil.experiences.flatMap((e) => [e.entreprise, e.lieu ?? '', e.periode ?? '']),
    ...profil.formations.flatMap((f) => [f.etablissement, f.lieu ?? '', f.periode ?? '', f.description ?? '']),
    ...profil.langues.map((l) => `${l.nom} ${l.niveau ?? ''}`),
  ].join('\n')
}

// Les durées (« 4 ans », « 6 mois ») ne sont acceptées que si elles figurent telles quelles dans le profil :
// le modèle les déduit des dates (souvent à tort, surtout quand des expériences ont été écartées).
const MOTIF_DUREE = /\b\d+\s*(?:ans?|années?|mois)\b/gi
function dureesFideles(texte: string, source: string): boolean {
  const reference = normaliser(source).replace(/\s+/g, ' ')
  return (texte.match(MOTIF_DUREE) ?? []).every((duree) => reference.includes(normaliser(duree).replace(/\s+/g, ' ')))
}

const LONGUEUR_MAX_ACCROCHE = 450

// Le prompt demande 400 caractères maximum ; un petit modèle l'ignore parfois et répète les mêmes idées.
// On coupe à la dernière phrase complète qui tient dans la limite ; sans phrase exploitable, on rejette.
export function borneAccroche(accroche: string): string {
  const texte = accroche.trim()
  if (texte.length <= LONGUEUR_MAX_ACCROCHE) return texte
  const coupe = texte.slice(0, LONGUEUR_MAX_ACCROCHE)
  const fin = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('.'))
  return fin >= 60 ? coupe.slice(0, fin + 1) : ''
}

// Enchaîne les étapes : mots-clés → pertinence (tri) → réécriture expérience par expérience → titre + accroche.
// Les faits (postes, entreprises, dates, formations, langues, compétences) sont recopiés du profil, jamais générés.
// Ce qui n'a aucun rapport avec l'offre est écarté du CV (et listé dans `ecartes` pour que l'utilisateur décide).
export async function adapterCv(
  moteur: MoteurLLM,
  profilBrut: Profil,
  offre: Offre,
  options: OptionsAdaptation = {},
): Promise<CvAdapte> {
  const signaler = options.surEtape ?? (() => undefined)
  // Une compétence est un terme court : les phrases décrivant des tâches (souvent issues d'un CV mal structuré)
  // n'ont pas leur place dans la section Compétences et ne sont jamais traitées comme telles.
  const profil: Profil = {
    ...profilBrut,
    competences: eclaterCompetences(profilBrut.competences).filter(estCompetenceCourte),
  }
  // L'analyse d'une offre ne dépend pas du profil : si elle est déjà connue (relance, autre profil), on la réutilise.
  let analyse = options.analyse
  if (!analyse) {
    signaler({ etape: 'Analyse de l’offre' })
    analyse = await analyserOffre(moteur, offre)
    options.surAnalyse?.(analyse)
  }
  signaler({ etape: 'Choix des éléments du profil à mettre en avant' })
  const pertinence = await evaluerPertinence(moteur, profil, analyse)

  const termesOffre = [...analyse.motsCles, ...analyse.competencesRequises, offre.texteBrut]
  const termesNormalises = termesOffre.map(normaliser)

  const indicesExperiences = indicesConserves(pertinence.experiences)
  const indicesFormations = indicesConserves(pertinence.formations)
  // Une compétence n'est jamais écartée, quoi qu'en dise le modèle, si l'offre la cite mot pour mot ou si elle
  // apparaît dans une expérience conservée (RGAA, SEO…) : elle y est attestée.
  const texteConserve = normaliser(
    indicesExperiences
      .flatMap((i) => (profil.experiences[i] ? [texteExperience(profil.experiences[i])] : []))
      .join('\n'),
  )
  // Les savoir-être (rigueur, autonomie, travail en équipe…) servent dans tous les métiers : toujours conservés.
  const citees = new Set(
    profil.competences.flatMap((c, i) =>
      estSavoirEtre(c) || competenceCitee(c, termesNormalises) || competenceCitee(c, [texteConserve]) ? [i] : [],
    ),
  )
  const indicesCompetences = indicesConserves(pertinence.competences, citees)

  // Ordre chronologique du profil conservé dans le CV ; la pertinence règle le niveau de détail.
  // Séquentiel volontairement : un modèle local ne traite qu'une requête à la fois.
  const experiences: ExperienceAdaptee[] = []
  for (const indice of indicesExperiences) {
    const experience = profil.experiences[indice]
    if (!experience) continue
    const maxPoints = pertinence.experiences[indice] === 2 ? POINTS_PRIORITAIRES : POINTS_SECONDAIRES
    let points: string[]
    if (options.reformuler) {
      signaler({
        etape: 'Reformulation des expériences',
        courant: experiences.length + 1,
        total: indicesExperiences.length,
      })
      points = await reecrireExperience(moteur, experience, analyse, maxPoints)
    } else {
      // Mode rapide (défaut) : sélection des puces d'origine les plus proches de l'offre, sans appel au modèle.
      points = selectionnerPoints(
        experience,
        [...analyse.motsCles, ...analyse.competencesRequises, analyse.titreCible],
        maxPoints,
      )
    }
    experiences.push({
      indice,
      poste: experience.poste,
      entreprise: experience.entreprise,
      lieu: experience.lieu,
      periode: experience.periode,
      points,
    })
  }

  const experiencesEcartees = profil.experiences.flatMap((e, indice) =>
    indicesExperiences.includes(indice)
      ? []
      : [
          {
            indice,
            poste: e.poste,
            entreprise: e.entreprise,
            lieu: e.lieu,
            periode: e.periode,
            points: pointsOrigine(e),
          },
        ],
  )
  const competencesGardees = indicesCompetences.flatMap((i) => profil.competences[i] ?? [])
  const competencesEcartees = profil.competences.filter((_, i) => !indicesCompetences.includes(i))
  const formationsGardees = indicesFormations.flatMap((i) => profil.formations[i] ?? [])
  const formationsEcartees = profil.formations.filter((_, i) => !indicesFormations.includes(i))
  const aEcarte = experiencesEcartees.length > 0 || competencesEcartees.length > 0 || formationsEcartees.length > 0

  // Le titre et l'accroche d'origine résument tout le profil : ils ne sont transmis au modèle que si rien
  // n'a été écarté (sinon ils réintroduiraient le domaine écarté).
  const profilRetenu: Profil = {
    ...profil,
    titrePoste: aEcarte ? undefined : profil.titrePoste,
    accroche: aEcarte ? undefined : profil.accroche,
    experiences: indicesExperiences.flatMap((i) => profil.experiences[i] ?? []),
    competences: competencesGardees,
    formations: formationsGardees,
  }
  signaler({ etape: 'Rédaction de l’accroche' })
  const redige = await redigerAccroche(
    moteur,
    profilRetenu,
    experiences,
    restreindreAnalyse(analyse, texteProfil(profilRetenu)),
  )

  // Garde-fou en code (le prompt seul ne suffit pas, notamment face à une offre piégée) : un titre ou une
  // accroche qui cite un terme de l'offre absent du profil, un nombre inconnu ou un élément écarté
  // est remplacé par une valeur issue du profil.
  const source = texteVerification(profil)
  const termesInterdits = [
    ...[...analyse.motsCles, ...analyse.competencesRequises].filter(
      (terme) => !contientMot(normaliser(source), normaliser(terme)),
    ),
    ...competencesEcartees,
    ...experiencesEcartees.flatMap((e) => [e.poste, e.entreprise]),
  ]
  // Titre : celui de l'offre visée (nettoyé de « H/F », du contrat et du nom de l'entreprise), comme le veut l'usage
  // pour passer le premier tri. Jamais rédigé par le modèle. Repli : titre du profil, puis poste conservé le plus pertinent.
  const rang = (indice: number) => pertinence.experiences[indice] ?? 0
  const principale = [...experiences].sort((a, b) => rang(b.indice ?? 0) - rang(a.indice ?? 0))[0]
  const titre =
    nettoyerTitreOffre(offre.titrePoste, offre.entreprise) ||
    (aEcarte ? principale?.poste : (profil.titrePoste ?? principale?.poste)) ||
    ''
  const proposee = borneAccroche(redige.accroche)
  const accrocheFidele =
    proposee !== '' && pointFidele(proposee, source, termesInterdits) && dureesFideles(proposee, source)
  // Compétences demandées par l'offre, rapprochées du profil. Celles que le profil atteste figurent déjà dans le
  // CV (compétences ou expériences, que les ATS lisent en texte) ; les absentes sont seulement PROPOSÉES à
  // l'utilisateur, qui coche celles qu'il maîtrise.
  const couverture = analyserCouverture(profil, analyse)
  // Repli si l'accroche du modèle est rejetée : une phrase composée des compétences demandées que le profil atteste.
  const attesteesCourtes = couverture.attestees.filter((t) => t.split(/s+/).length <= 3).slice(0, 4)
  const accrocheRepliOffre =
    attesteesCourtes.length > 0 ? `Je mets en avant mes compétences en ${attesteesCourtes.join(', ')}.` : ''
  const accroche = accrocheFidele ? proposee : aEcarte ? accrocheRepliOffre : (profil.accroche ?? accrocheRepliOffre)
  const listees = prioriserCompetences(competencesGardees, termesOffre)
  // Compétences clés : celles que demande l'offre et que le profil atteste, avec la formulation de l'offre (c'est
  // elle que cherche un ATS). Retirées de la liste générale pour ne pas apparaître deux fois.
  const demandesCourtes = couverture.attestees.filter(estCompetenceCourte).map(formaterCompetence)
  // Les qualités demandées (« autonomie », « sens du conseil ») vont dans la ligne Savoir-être, pas parmi les outils.
  const competencesCles = demandesCourtes
    .filter((t) => !estSavoirEtre(t))
    .filter((t, i, tous) => tous.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, MAX_COMPETENCES_CLES)
  const generales = listees.filter((c) => !dejaListee(c, competencesCles) || estSavoirEtre(c))
  // Lisibilité : savoir-être d'abord, puis outils et techniques, plafonnés.
  const qualitesDemandees = demandesCourtes.filter(estSavoirEtre)
  const savoirEtre = sansDoublons([...qualitesDemandees, ...generales.filter(estSavoirEtre)]).slice(0, MAX_SAVOIR_ETRE)
  const techniques = generales.filter((c) => !estSavoirEtre(c)).slice(0, MAX_TECHNIQUES)

  return cvAdapteSchema.parse({
    titre,
    accroche,
    experiences,
    competencesCles,
    competences: [...savoirEtre, ...techniques],
    demandees: couverture,
    formations: formationsGardees,
    langues: profil.langues,
    ecartes: { experiences: experiencesEcartees, competences: competencesEcartees, formations: formationsEcartees },
  })
}
