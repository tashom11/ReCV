import type { OptionsAdaptation } from '../llm/fournisseur'
import type { MoteurLLM } from '../llm/moteur'
import { nettoyerTitreOffre } from '../offre/texte'
import { type JobPosting, type Profile, type TailoredCv, type TailoredExperience, tailoredCvSchema } from '../schemas'
import {
  eclaterCompetences,
  estCompetenceCourte,
  estSavoirEtre,
  formaterCompetence,
  phraseQualites,
  sansDoublons,
} from './competences'
import { analyserCouverture, dejaListee } from './couverture'
import { analyserOffre } from './motsCles'
import { evaluerPertinence, indicesConserves } from './pertinence'
import { pointFidele, pointsOrigine, pointsProchesOffre, reecrireExperience, selectionnerPoints } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { redigerAccroche } from './titreAccroche'
import { motsNonAttestes } from './vocabulaire'

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

function texteProfil(profil: Profile): string {
  return [
    profil.headline ?? '',
    profil.summary ?? '',
    ...profil.experiences.map(texteExperience),
    ...profil.skills,
    ...profil.education.map((formation) => formation.degree),
  ].join('\n')
}

// Source de vérification de l'accroche et du titre : tout ce que le profil affirme, dates et lieux compris.
function texteVerification(profil: Profile): string {
  return [
    texteProfil(profil),
    ...profil.experiences.flatMap((e) => [e.company, e.location ?? '', e.dateRange ?? '']),
    ...profil.education.flatMap((f) => [f.school, f.location ?? '', f.dateRange ?? '', f.description ?? '']),
    ...profil.languages.map((l) => `${l.name} ${l.level ?? ''}`),
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
// Une compétence est un terme court : les phrases décrivant des tâches (souvent issues d'un CV mal structuré)
// n'ont pas leur place dans la section Compétences et ne sont jamais traitées comme telles.
export function preparerProfil(profil: Profile): Profile {
  return { ...profil, skills: eclaterCompetences(profil.skills).filter(estCompetenceCourte) }
}

// Annulation : chaque appel au modèle vérifie le signal avant de partir et le transmet au moteur.
function avecSignal(moteur: MoteurLLM, signal: AbortSignal | undefined): MoteurLLM {
  if (!signal) return moteur
  return {
    genererObjet: (requete) => {
      signal.throwIfAborted()
      return moteur.genererObjet({ ...requete, signal })
    },
  }
}

export async function adapterCv(
  moteurBrut: MoteurLLM,
  profilBrut: Profile,
  offre: JobPosting,
  options: OptionsAdaptation = {},
): Promise<TailoredCv> {
  const signaler = options.surEtape ?? (() => undefined)
  const moteur = avecSignal(moteurBrut, options.signal)
  const profil = preparerProfil(profilBrut)
  // L'analyse d'une offre ne dépend pas du profil : si elle est déjà connue (relance, autre profil), on la réutilise.
  let analyse = options.analyse
  if (!analyse) {
    signaler({ cle: 'analyse', etape: 'Analyse de l’offre' })
    analyse = await analyserOffre(moteur, offre)
    options.surAnalyse?.(analyse)
  }
  signaler({ cle: 'selection', etape: 'Choix des éléments du profil à mettre en avant' })
  const pertinence = await evaluerPertinence(moteur, profil, analyse)

  const termesOffre = [...analyse.motsCles, ...analyse.competencesRequises, offre.rawText]
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
    profil.skills.flatMap((c, i) =>
      estSavoirEtre(c) || competenceCitee(c, termesNormalises) || competenceCitee(c, [texteConserve]) ? [i] : [],
    ),
  )
  const indicesCompetences = indicesConserves(pertinence.competences, citees)

  // Ordre chronologique du profil conservé dans le CV ; la pertinence règle le niveau de détail.
  // Séquentiel volontairement : un modèle local ne traite qu'une requête à la fois.
  const experiences: TailoredExperience[] = []
  for (const indice of indicesExperiences) {
    const experience = profil.experiences[indice]
    if (!experience) continue
    const maxPoints = pertinence.experiences[indice] === 2 ? POINTS_PRIORITAIRES : POINTS_SECONDAIRES
    let points: string[]
    if (options.reformuler) {
      signaler({
        cle: 'reformulation',
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
      sourceIndex: indice,
      position: experience.position,
      company: experience.company,
      location: experience.location,
      dateRange: experience.dateRange,
      bullets: points,
    })
  }

  const experiencesEcartees = profil.experiences.flatMap((e, indice) =>
    indicesExperiences.includes(indice)
      ? []
      : [
          {
            sourceIndex: indice,
            position: e.position,
            company: e.company,
            location: e.location,
            dateRange: e.dateRange,
            bullets: pointsOrigine(e),
          },
        ],
  )
  const competencesGardees = indicesCompetences.flatMap((i) => profil.skills[i] ?? [])
  const competencesEcartees = profil.skills.filter((_, i) => !indicesCompetences.includes(i))
  const formationsGardees = indicesFormations.flatMap((i) => profil.education[i] ?? [])
  const formationsEcartees = profil.education.filter((_, i) => !indicesFormations.includes(i))
  const aEcarte = experiencesEcartees.length > 0 || competencesEcartees.length > 0 || formationsEcartees.length > 0

  // Couverture des exigences de l'offre par le profil (réutilisée plus bas pour les compétences clés).
  const couverture = analyserCouverture(profil, analyse)

  // L'accroche ne doit parler que de ce qui répond à l'offre. Ni l'ancienne accroche du profil (écrite pour un autre
  // métier), ni les tâches sans rapport : elles donnaient « transformer des maquettes en sites web » à une offre de
  // recrutement. Le modèle ne reçoit que les savoir-être, les exigences attestées et les réalisations qui recoupent
  // des termes de l'offre.
  const termesProches = [...analyse.competencesRequises, ...analyse.qualites, ...analyse.motsCles, analyse.titreCible]
  const contenuAccroche = {
    competences: sansDoublons([
      ...couverture.evidenced.filter(estCompetenceCourte),
      ...competencesGardees.filter(estSavoirEtre),
    ]),
    realisations: indicesExperiences.flatMap((i) =>
      profil.experiences[i] ? pointsProchesOffre(profil.experiences[i], termesProches, 3) : [],
    ),
  }
  signaler({ cle: 'accroche', etape: 'Rédaction de l’accroche' })
  const redige = await redigerAccroche(moteur, contenuAccroche, analyse)

  // Garde-fou en code (le prompt seul ne suffit pas, notamment face à une offre piégée) : un titre ou une
  // accroche qui cite un terme de l'offre absent du profil, un nombre inconnu ou un élément écarté
  // est remplacé par une valeur issue du profil.
  const source = texteVerification(profil)
  const termesInterdits = [
    ...[...analyse.motsCles, ...analyse.competencesRequises].filter(
      (terme) => !contientMot(normaliser(source), normaliser(terme)),
    ),
    ...competencesEcartees,
    ...experiencesEcartees.flatMap((e) => [e.position, e.company]),
  ]
  // Titre : celui de l'offre visée (nettoyé de « H/F », du contrat et du nom de l'entreprise), comme le veut l'usage
  // pour passer le premier tri. Jamais rédigé par le modèle. Repli : titre du profil, puis poste conservé le plus pertinent.
  const rang = (indice: number) => pertinence.experiences[indice] ?? 0
  const principale = [...experiences].sort((a, b) => rang(b.sourceIndex ?? 0) - rang(a.sourceIndex ?? 0))[0]
  const titre =
    nettoyerTitreOffre(offre.jobTitle, offre.company) ||
    (aEcarte ? principale?.position : (profil.headline ?? principale?.position)) ||
    ''
  const proposee = borneAccroche(redige.accroche)
  // Vocabulaire autorisé : celui de l'offre et les données confiées au modèle. Un mot qui n'en vient pas (« maquettes »,
  // « atelier ») est une dérive vers le reste du profil ; au plus un écart est toléré.
  const vocabulaire = [
    offre.rawText,
    ...termesProches,
    ...contenuAccroche.competences,
    ...contenuAccroche.realisations,
  ].join(' ')
  const accrocheFidele =
    proposee !== '' &&
    pointFidele(proposee, source, termesInterdits) &&
    dureesFideles(proposee, source) &&
    motsNonAttestes(proposee, vocabulaire).length <= 1
  // Repli : phrase de qualités attestées demandées par l'offre, puis autres savoir-être du profil. Jamais l'ancienne
  // accroche du profil, souvent rédigée pour un autre métier.
  const qualitesAttestees = contenuAccroche.competences.filter(estSavoirEtre).slice(0, 4)
  const accrocheRepliQualites = phraseQualites(qualitesAttestees)
  const attesteesCourtes = couverture.evidenced.filter((t) => t.split(/\s+/).length <= 3).slice(0, 4)
  const accrocheRepliOffre =
    attesteesCourtes.length > 0 ? `Je mets en avant mes compétences en ${attesteesCourtes.join(', ')}.` : ''
  const accroche = accrocheFidele ? proposee : accrocheRepliQualites || accrocheRepliOffre

  const listees = prioriserCompetences(competencesGardees, termesOffre)
  // Compétences clés : celles que demande l'offre et que le profil atteste, avec la formulation de l'offre (c'est
  // elle que cherche un ATS). Retirées de la liste générale pour ne pas apparaître deux fois.
  const demandesCourtes = couverture.evidenced.filter(estCompetenceCourte).map(formaterCompetence)
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

  return tailoredCvSchema.parse({
    headline: titre,
    summary: accroche,
    experiences,
    keySkills: competencesCles,
    skills: [...savoirEtre, ...techniques],
    requested: couverture,
    education: formationsGardees,
    languages: profil.languages,
    excluded: { experiences: experiencesEcartees, skills: competencesEcartees, education: formationsEcartees },
  })
}
