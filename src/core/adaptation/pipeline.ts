import type { MoteurLLM } from '../llm/moteur'
import { type CvAdapte, cvAdapteSchema, type ExperienceAdaptee, type Offre, type Profil } from '../schemas'
import { classerExperiences } from './classement'
import { analyserOffre, restreindreAnalyse } from './motsCles'
import { pointFidele, reecrireExperience } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'
import { redigerTitreAccroche } from './titreAccroche'

// Nombre de puces : les 2 expériences les plus pertinentes sont plus détaillées.
const POINTS_PRIORITAIRES = 5
const POINTS_SECONDAIRES = 3

// Calculé en code, pas par le LLM : sous-ensemble exact des compétences du profil,
// celles citées par l'offre en premier (ordre d'origine conservé sinon).
export function prioriserCompetences(competences: string[], termesOffre: string[]): string[] {
  const termes = termesOffre.map(normaliser)
  const citee = (competence: string) => {
    const c = normaliser(competence)
    return termes.some((terme) => contientMot(terme, c) || contientMot(c, terme))
  }
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

// Enchaîne les étapes : mots-clés → classement → réécriture expérience par expérience → titre + accroche.
// Les faits (postes, entreprises, dates, formations, langues, compétences) sont recopiés du profil, jamais générés.
export async function adapterCv(moteur: MoteurLLM, profil: Profil, offre: Offre): Promise<CvAdapte> {
  const analyse = await analyserOffre(moteur, offre)
  const ordre = await classerExperiences(moteur, profil.experiences, analyse)
  const rang = new Map(ordre.map((indice, position) => [indice, position]))

  // Ordre chronologique du profil conservé dans le CV ; le classement règle le niveau de détail.
  // Séquentiel volontairement : un modèle local ne traite qu'une requête à la fois.
  const experiences: ExperienceAdaptee[] = []
  for (const [indice, experience] of profil.experiences.entries()) {
    const maxPoints = (rang.get(indice) ?? 0) < 2 ? POINTS_PRIORITAIRES : POINTS_SECONDAIRES
    experiences.push({
      poste: experience.poste,
      entreprise: experience.entreprise,
      lieu: experience.lieu,
      periode: experience.periode,
      points: await reecrireExperience(moteur, experience, analyse, maxPoints),
    })
  }

  const redige = await redigerTitreAccroche(
    moteur,
    profil,
    experiences,
    restreindreAnalyse(analyse, texteProfil(profil)),
  )
  // Garde-fou en code (le prompt seul ne suffit pas, notamment face à une offre piégée) : un titre ou une
  // accroche qui cite un terme de l'offre absent du profil ou un nombre inconnu est remplacé par l'original.
  const source = texteVerification(profil)
  const termesAbsents = [...analyse.motsCles, ...analyse.competencesRequises].filter(
    (terme) => !contientMot(normaliser(source), normaliser(terme)),
  )
  const titre = pointFidele(redige.titre, source, termesAbsents) ? redige.titre : (profil.titrePoste ?? '')
  const accroche = pointFidele(redige.accroche, source, termesAbsents) ? redige.accroche : (profil.accroche ?? '')
  return cvAdapteSchema.parse({
    titre,
    accroche,
    experiences,
    competences: prioriserCompetences(profil.competences, [
      ...analyse.motsCles,
      ...analyse.competencesRequises,
      offre.texteBrut,
    ]),
    formations: profil.formations,
    langues: profil.langues,
  })
}
