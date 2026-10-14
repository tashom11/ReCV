import { cleanJobTitle } from '../job-posting/text'
import type { LlmEngine } from '../llm/engine'
import type { TailoringOptions } from '../llm/provider'
import { type JobPosting, type Profile, type TailoredCv, type TailoredExperience, tailoredCvSchema } from '../schemas'
import { analyzeCoverage, dejaListee } from './coverage'
import { analyzeJobPosting } from './jobAnalysis'
import { evaluateRelevance, keptIndexes } from './relevance'
import { bulletsCloseToJob, isBulletFaithful, originalBullets, rewriteExperience, selectBullets } from './rewriting'
import { formatSkill, isShortSkill, isSoftSkill, softSkillsSentence, splitSkills, withoutDuplicates } from './skills'
import { writeSummary } from './summary'
import { containsWord, experienceText, normalize } from './text'
import { unsupportedWords } from './vocabulary'

const MAX_KEY_SKILLS = 12
const MAX_SOFT_SKILLS = 8
const MAX_HARD_SKILLS = 12

// Nombre de puces : plus détaillé pour ce qui est directement lié au poste visé.
const PRIORITY_BULLETS = 5
const SECONDARY_BULLETS = 3

// Vrai si la compétence est citée dans les termes de l'offre (comparaison par mots entiers).
// Une liste d'outils (« WordPress / CMS », « HTML, CSS ») est citée dès que l'une de ses parties l'est.
// On ne découpe que sur « / » et « , » : découper « Gestion & créa. de landing pages » sur « & » ferait
// valider la compétence par le seul mot « gestion », présent dans presque toutes les offres.
function isSkillCited(skill: string, normalizedTerms: string[]): boolean {
  const full = normalize(skill)
  const parts = [full, ...full.split(/\s*[/,]\s*/)].filter((part) => part.length >= 3)
  return parts.some((c) => normalizedTerms.some((term) => containsWord(term, c) || containsWord(c, term)))
}

// Calculé en code, pas par le LLM : sous-ensemble exact des compétences du profil,
// celles citées par l'offre en premier (ordre d'origine conservé sinon).
export function prioritizeSkills(skills: string[], jobTerms: string[]): string[] {
  const terms = jobTerms.map(normalize)
  const isCited = (skill: string) => isSkillCited(skill, terms)
  return [...skills.filter(isCited), ...skills.filter((skill) => !isCited(skill))]
}

function profileText(profile: Profile): string {
  return [
    profile.headline ?? '',
    profile.summary ?? '',
    ...profile.experiences.map(experienceText),
    ...profile.skills,
    ...profile.education.map((education) => education.degree),
  ].join('\n')
}

// Source de vérification de l'accroche et du titre : tout ce que le profil affirme, dates et lieux compris.
function verificationText(profile: Profile): string {
  return [
    profileText(profile),
    ...profile.experiences.flatMap((e) => [e.company, e.location ?? '', e.dateRange ?? '']),
    ...profile.education.flatMap((f) => [f.school, f.location ?? '', f.dateRange ?? '', f.description ?? '']),
    ...profile.languages.map((l) => `${l.name} ${l.level ?? ''}`),
  ].join('\n')
}

// Les durées (« 4 ans », « 6 mois ») ne sont acceptées que si elles figurent telles quelles dans le profil :
// le modèle les déduit des dates (souvent à tort, surtout quand des expériences ont été écartées).
const DURATION_PATTERN = /\b\d+\s*(?:ans?|années?|mois)\b/gi
function durationsAreFaithful(text: string, source: string): boolean {
  const reference = normalize(source).replace(/\s+/g, ' ')
  return (text.match(DURATION_PATTERN) ?? []).every((duration) =>
    reference.includes(normalize(duration).replace(/\s+/g, ' ')),
  )
}

const MAX_SUMMARY_LENGTH = 450

// Le prompt demande 400 caractères maximum ; un petit modèle l'ignore parfois et répète les mêmes idées.
// On coupe à la dernière phrase complète qui tient dans la limite ; sans phrase exploitable, on rejette.
export function boundSummary(summary: string): string {
  const text = summary.trim()
  if (text.length <= MAX_SUMMARY_LENGTH) return text
  const cut = text.slice(0, MAX_SUMMARY_LENGTH)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'))
  return end >= 60 ? cut.slice(0, end + 1) : ''
}

// Enchaîne les étapes : mots-clés → pertinence (tri) → réécriture expérience par expérience → titre + accroche.
// Les faits (postes, entreprises, dates, formations, langues, compétences) sont recopiés du profil, jamais générés.
// Ce qui n'a aucun rapport avec l'offre est écarté du CV (et listé dans `ecartes` pour que l'utilisateur décide).
// Une compétence est un terme court : les phrases décrivant des tâches (souvent issues d'un CV mal structuré)
// n'ont pas leur place dans la section Compétences et ne sont jamais traitées comme telles.
export function prepareProfile(profile: Profile): Profile {
  return { ...profile, skills: splitSkills(profile.skills).filter(isShortSkill) }
}

// Annulation : chaque appel au modèle vérifie le signal avant de partir et le transmet au moteur.
function withSignal(engine: LlmEngine, signal: AbortSignal | undefined): LlmEngine {
  if (!signal) return engine
  return {
    generateObject: (request) => {
      signal.throwIfAborted()
      return engine.generateObject({ ...request, signal })
    },
  }
}

export async function tailorCv(
  rawEngine: LlmEngine,
  rawProfile: Profile,
  jobPosting: JobPosting,
  options: TailoringOptions = {},
): Promise<TailoredCv> {
  const report = options.onStep ?? (() => undefined)
  const engine = withSignal(rawEngine, options.signal)
  const profile = prepareProfile(rawProfile)
  // L'analyse d'une offre ne dépend pas du profil : si elle est déjà connue (relance, autre profil), on la réutilise.
  let analysis = options.analysis
  if (!analysis) {
    report({ key: 'analyse', label: 'Analyse de l’offre' })
    analysis = await analyzeJobPosting(engine, jobPosting)
    options.onAnalysis?.(analysis)
  }
  report({ key: 'selection', label: 'Choix des éléments du profil à mettre en avant' })
  const relevance = await evaluateRelevance(engine, profile, analysis)

  const jobTerms = [...analysis.keywords, ...analysis.requiredSkills, jobPosting.rawText]
  const normalizedTerms = jobTerms.map(normalize)

  const experienceIndices = keptIndexes(relevance.experiences)
  const educationIndices = keptIndexes(relevance.education)
  // Une compétence n'est jamais écartée, quoi qu'en dise le modèle, si l'offre la cite mot pour mot ou si elle
  // apparaît dans une expérience conservée (RGAA, SEO…) : elle y est attestée.
  const keptText = normalize(
    experienceIndices
      .flatMap((i) => (profile.experiences[i] ? [experienceText(profile.experiences[i])] : []))
      .join('\n'),
  )
  // Les savoir-être (rigueur, autonomie, travail en équipe…) servent dans tous les métiers : toujours conservés.
  const cited = new Set(
    profile.skills.flatMap((c, i) =>
      isSoftSkill(c) || isSkillCited(c, normalizedTerms) || isSkillCited(c, [keptText]) ? [i] : [],
    ),
  )
  const skillIndices = keptIndexes(relevance.skills, cited)

  // Ordre chronologique du profil conservé dans le CV ; la pertinence règle le niveau de détail.
  // Séquentiel volontairement : un modèle local ne traite qu'une requête à la fois.
  const experiences: TailoredExperience[] = []
  for (const index of experienceIndices) {
    const experience = profile.experiences[index]
    if (!experience) continue
    const maxPoints = relevance.experiences[index] === 2 ? PRIORITY_BULLETS : SECONDARY_BULLETS
    let bullets: string[]
    if (options.rewrite) {
      report({
        key: 'reformulation',
        label: 'Reformulation des expériences',
        current: experiences.length + 1,
        total: experienceIndices.length,
      })
      bullets = await rewriteExperience(engine, experience, analysis, maxPoints)
    } else {
      // Mode rapide (défaut) : sélection des puces d'origine les plus proches de l'offre, sans appel au modèle.
      bullets = selectBullets(
        experience,
        [...analysis.keywords, ...analysis.requiredSkills, analysis.targetTitle],
        maxPoints,
      )
    }
    experiences.push({
      sourceIndex: index,
      position: experience.position,
      company: experience.company,
      location: experience.location,
      dateRange: experience.dateRange,
      bullets: bullets,
    })
  }

  const excludedExperiences = profile.experiences.flatMap((e, index) =>
    experienceIndices.includes(index)
      ? []
      : [
          {
            sourceIndex: index,
            position: e.position,
            company: e.company,
            location: e.location,
            dateRange: e.dateRange,
            bullets: originalBullets(e),
          },
        ],
  )
  const keptSkills = skillIndices.flatMap((i) => profile.skills[i] ?? [])
  const excludedSkills = profile.skills.filter((_, i) => !skillIndices.includes(i))
  const keptEducation = educationIndices.flatMap((i) => profile.education[i] ?? [])
  const excludedEducation = profile.education.filter((_, i) => !educationIndices.includes(i))
  const hasExcluded = excludedExperiences.length > 0 || excludedSkills.length > 0 || excludedEducation.length > 0

  // Couverture des exigences de l'offre par le profil (réutilisée plus bas pour les compétences clés).
  const coverage = analyzeCoverage(profile, analysis)

  // L'accroche ne doit parler que de ce qui répond à l'offre. Ni l'ancienne accroche du profil (écrite pour un autre
  // métier), ni les tâches sans rapport : elles donnaient « transformer des maquettes en sites web » à une offre de
  // recrutement. Le modèle ne reçoit que les savoir-être, les exigences attestées et les réalisations qui recoupent
  // des termes de l'offre.
  const nearbyTerms = [...analysis.requiredSkills, ...analysis.softSkills, ...analysis.keywords, analysis.targetTitle]
  const summaryInput = {
    skills: withoutDuplicates([...coverage.evidenced.filter(isShortSkill), ...keptSkills.filter(isSoftSkill)]),
    achievements: experienceIndices.flatMap((i) =>
      profile.experiences[i] ? bulletsCloseToJob(profile.experiences[i], nearbyTerms, 3) : [],
    ),
  }
  report({ key: 'accroche', label: 'Rédaction de l’accroche' })
  const written = await writeSummary(engine, summaryInput, analysis)

  // Garde-fou en code (le prompt seul ne suffit pas, notamment face à une offre piégée) : un titre ou une
  // accroche qui cite un terme de l'offre absent du profil, un nombre inconnu ou un élément écarté
  // est remplacé par une valeur issue du profil.
  const source = verificationText(profile)
  const forbiddenTerms = [
    ...[...analysis.keywords, ...analysis.requiredSkills].filter(
      (term) => !containsWord(normalize(source), normalize(term)),
    ),
    ...excludedSkills,
    ...excludedExperiences.flatMap((e) => [e.position, e.company]),
  ]
  // Titre : celui de l'offre visée (nettoyé de « H/F », du contrat et du nom de l'entreprise), comme le veut l'usage
  // pour passer le premier tri. Jamais rédigé par le modèle. Repli : titre du profil, puis poste conservé le plus pertinent.
  const rank = (index: number) => relevance.experiences[index] ?? 0
  const main = [...experiences].sort((a, b) => rank(b.sourceIndex ?? 0) - rank(a.sourceIndex ?? 0))[0]
  const title =
    cleanJobTitle(jobPosting.jobTitle, jobPosting.company) ||
    (hasExcluded ? main?.position : (profile.headline ?? main?.position)) ||
    ''
  const proposed = boundSummary(written.summary)
  // Vocabulaire autorisé : celui de l'offre et les données confiées au modèle. Un mot qui n'en vient pas (« maquettes »,
  // « atelier ») est une dérive vers le reste du profil ; au plus un écart est toléré.
  const vocabulary = [jobPosting.rawText, ...nearbyTerms, ...summaryInput.skills, ...summaryInput.achievements].join(
    ' ',
  )
  const summaryIsFaithful =
    proposed !== '' &&
    isBulletFaithful(proposed, source, forbiddenTerms) &&
    durationsAreFaithful(proposed, source) &&
    unsupportedWords(proposed, vocabulary).length <= 1
  // Repli : phrase de qualités attestées demandées par l'offre, puis autres savoir-être du profil. Jamais l'ancienne
  // accroche du profil, souvent rédigée pour un autre métier.
  const evidencedSoftSkills = summaryInput.skills.filter(isSoftSkill).slice(0, 4)
  const softSkillsFallbackSummary = softSkillsSentence(evidencedSoftSkills)
  const shortEvidenced = coverage.evidenced.filter((t) => t.split(/\s+/).length <= 3).slice(0, 4)
  const jobFallbackSummary =
    shortEvidenced.length > 0 ? `Je mets en avant mes compétences en ${shortEvidenced.join(', ')}.` : ''
  const summary = summaryIsFaithful ? proposed : softSkillsFallbackSummary || jobFallbackSummary

  const listed = prioritizeSkills(keptSkills, jobTerms)
  // Compétences clés : celles que demande l'offre et que le profil atteste, avec la formulation de l'offre (c'est
  // elle que cherche un ATS). Retirées de la liste générale pour ne pas apparaître deux fois.
  const shortRequested = coverage.evidenced.filter(isShortSkill).map(formatSkill)
  // Les qualités demandées (« autonomie », « sens du conseil ») vont dans la ligne Savoir-être, pas parmi les outils.
  const keySkills = shortRequested
    .filter((t) => !isSoftSkill(t))
    .filter((t, i, all) => all.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, MAX_KEY_SKILLS)
  const general = listed.filter((c) => !dejaListee(c, keySkills) || isSoftSkill(c))
  // Lisibilité : savoir-être d'abord, puis outils et techniques, plafonnés.
  const requestedSoftSkills = shortRequested.filter(isSoftSkill)
  const softSkills = withoutDuplicates([...requestedSoftSkills, ...general.filter(isSoftSkill)]).slice(
    0,
    MAX_SOFT_SKILLS,
  )
  const hardSkills = general.filter((c) => !isSoftSkill(c)).slice(0, MAX_HARD_SKILLS)

  return tailoredCvSchema.parse({
    headline: title,
    summary: summary,
    experiences,
    keySkills: keySkills,
    skills: [...softSkills, ...hardSkills],
    requested: coverage,
    education: keptEducation,
    languages: profile.languages,
    excluded: { experiences: excludedExperiences, skills: excludedSkills, education: excludedEducation },
  })
}
