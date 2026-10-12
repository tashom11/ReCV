import type { MoteurLLM } from '../llm/moteur'
import { type CvAdapte, cvAdapteSchema, type ExperienceAdaptee, type Offre, type Profil } from '../schemas'
import { analyserOffre, restreindreAnalyse } from './motsCles'
import { evaluerPertinence, indicesConserves } from './pertinence'
import { pointFidele, pointsOrigine, reecrireExperience } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { redigerAccroche } from './titreAccroche'

// Nombre de puces : plus détaillé pour ce qui est directement lié au poste visé.
const POINTS_PRIORITAIRES = 5
const POINTS_SECONDAIRES = 3

// Vrai si la compétence est citée dans les termes de l'offre (comparaison par mots entiers).
// Une compétence composée (« WordPress / CMS », « HTML, CSS ») est citée dès que l'une de ses parties l'est.
function competenceCitee(competence: string, termesNormalises: string[]): boolean {
  const parties = normaliser(competence)
    .split(/\s*[/,&+|]\s*/)
    .filter((partie) => partie.length > 0)
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

// Enchaîne les étapes : mots-clés → pertinence (tri) → réécriture expérience par expérience → titre + accroche.
// Les faits (postes, entreprises, dates, formations, langues, compétences) sont recopiés du profil, jamais générés.
// Ce qui n'a aucun rapport avec l'offre est écarté du CV (et listé dans `ecartes` pour que l'utilisateur décide).
export async function adapterCv(moteur: MoteurLLM, profil: Profil, offre: Offre): Promise<CvAdapte> {
  const analyse = await analyserOffre(moteur, offre)
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
  const citees = new Set(
    profil.competences.flatMap((c, i) =>
      competenceCitee(c, termesNormalises) || competenceCitee(c, [texteConserve]) ? [i] : [],
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
    experiences.push({
      indice,
      poste: experience.poste,
      entreprise: experience.entreprise,
      lieu: experience.lieu,
      periode: experience.periode,
      points: await reecrireExperience(moteur, experience, analyse, maxPoints),
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
  // Titre : jamais rédigé par le modèle. Titre d'origine du profil si rien n'est écarté ; sinon l'intitulé de
  // l'expérience conservée la plus pertinente (la plus récente à pertinence égale).
  const rang = (indice: number) => pertinence.experiences[indice] ?? 0
  const principale = [...experiences].sort((a, b) => rang(b.indice ?? 0) - rang(a.indice ?? 0))[0]
  const titre = (aEcarte ? principale?.poste : (profil.titrePoste ?? principale?.poste)) ?? ''
  const accrocheFidele = pointFidele(redige.accroche, source, termesInterdits) && dureesFideles(redige.accroche, source)
  const accroche = accrocheFidele ? redige.accroche : aEcarte ? '' : (profil.accroche ?? '')

  return cvAdapteSchema.parse({
    titre,
    accroche,
    experiences,
    competences: prioriserCompetences(competencesGardees, termesOffre),
    formations: formationsGardees,
    langues: profil.langues,
    ecartes: { experiences: experiencesEcartees, competences: competencesEcartees, formations: formationsEcartees },
  })
}
