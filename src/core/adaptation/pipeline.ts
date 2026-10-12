import type { MoteurLLM } from '../llm/moteur'
import { type CvAdapte, cvAdapteSchema, type ExperienceAdaptee, type Offre, type Profil } from '../schemas'
import { analyserOffre, restreindreAnalyse } from './motsCles'
import { evaluerPertinence, indicesConserves } from './pertinence'
import { pointFidele, pointsOrigine, reecrireExperience } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { redigerTitreAccroche } from './titreAccroche'

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
  // Une compétence citée mot pour mot dans l'offre n'est jamais écartée, quoi qu'en dise le modèle.
  const citees = new Set(profil.competences.flatMap((c, i) => (competenceCitee(c, termesNormalises) ? [i] : [])))
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
  const redige = await redigerTitreAccroche(
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
  const premierPoste = experiences[0]?.poste
  const titreRepli = (aEcarte ? premierPoste : (profil.titrePoste ?? premierPoste)) ?? ''
  const accrocheRepli = aEcarte ? '' : (profil.accroche ?? '')
  const titre = pointFidele(redige.titre, source, termesInterdits) ? redige.titre : titreRepli
  const accroche = pointFidele(redige.accroche, source, termesInterdits) ? redige.accroche : accrocheRepli

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
