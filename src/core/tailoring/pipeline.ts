import { cleanJobTitle } from '../job-posting/text'
import type { LlmEngine } from '../llm/engine'
import type { TailoringOptions } from '../llm/provider'
import { type JobPosting, type Profile, type TailoredCv, type TailoredExperience, tailoredCvSchema } from '../schemas'
import { analyzeCoverage, isAlreadyListed } from './coverage'
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

// Number of bullets: more detail for what is directly related to the target position.
const PRIORITY_BULLETS = 5
const SECONDARY_BULLETS = 3

// True if the skill is quoted in the job posting terms (whole-word comparison).
// A list of tools (« WordPress / CMS », « HTML, CSS ») is quoted as soon as one of its parts is.
// It is only split on « / » and « , »: splitting « Gestion & créa. de landing pages » on « & » would validate the
// skill on the word « gestion » alone, present in almost every job posting.
function isSkillCited(skill: string, normalizedTerms: string[]): boolean {
  const full = normalize(skill)
  const parts = [full, ...full.split(/\s*[/,]\s*/)].filter((part) => part.length >= 3)
  return parts.some((c) => normalizedTerms.some((term) => containsWord(term, c) || containsWord(c, term)))
}

// Computed in code, not by the LLM: exact subset of the profile skills, those quoted by the job posting first
// (original order kept otherwise).
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

// Reference to check the summary and the headline: everything the profile states, dates and locations included.
function verificationText(profile: Profile): string {
  return [
    profileText(profile),
    ...profile.experiences.flatMap((e) => [e.company, e.location ?? '', e.dateRange ?? '']),
    ...profile.education.flatMap((f) => [f.school, f.location ?? '', f.dateRange ?? '', f.description ?? '']),
    ...profile.languages.map((l) => `${l.name} ${l.level ?? ''}`),
  ].join('\n')
}

// Durations (« 4 ans », « 6 mois ») are only accepted if they appear as such in the profile: the model infers them
// from the dates (often wrongly, especially when experiences have been excluded).
const DURATION_PATTERN = /\b\d+\s*(?:ans?|années?|mois)\b/gi
function durationsAreFaithful(text: string, source: string): boolean {
  const reference = normalize(source).replace(/\s+/g, ' ')
  return (text.match(DURATION_PATTERN) ?? []).every((duration) =>
    reference.includes(normalize(duration).replace(/\s+/g, ' ')),
  )
}

const MAX_SUMMARY_LENGTH = 450

// The prompt asks for 400 characters at most; a small model sometimes ignores it and repeats the same ideas.
// The summary is cut at the last complete sentence within the limit; without a usable sentence, it is rejected.
export function boundSummary(summary: string): string {
  const text = summary.trim()
  if (text.length <= MAX_SUMMARY_LENGTH) return text
  const cut = text.slice(0, MAX_SUMMARY_LENGTH)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'))
  return end >= 60 ? cut.slice(0, end + 1) : ''
}

// Chains the steps: keywords → relevance (sorting) → rewriting experience by experience → headline + summary.
// Facts (positions, companies, dates, education, languages, skills) are copied from the profile, never generated.
// What is unrelated to the job posting is left out of the CV (and listed in `excluded` for the user to decide).
// A skill is a short term: sentences describing tasks (often coming from a poorly structured CV) do not belong in the
// Skills section and are never treated as skills.
export function prepareProfile(profile: Profile): Profile {
  return { ...profile, skills: splitSkills(profile.skills).filter(isShortSkill) }
}

// Cancellation: each model call checks the signal before starting and passes it to the engine.
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
  // The analysis of a job posting does not depend on the profile:
  // if it is already known (retry, other profile), it is reused.
  let analysis = options.analysis
  if (!analysis) {
    report({ key: 'analysis', label: 'Analyse de l’offre' })
    analysis = await analyzeJobPosting(engine, jobPosting)
    options.onAnalysis?.(analysis)
  }
  report({ key: 'selection', label: 'Choix des éléments du profil à mettre en avant' })
  const relevance = await evaluateRelevance(engine, profile, analysis)

  const jobTerms = [...analysis.keywords, ...analysis.requiredSkills, jobPosting.rawText]
  const normalizedTerms = jobTerms.map(normalize)

  const experienceIndices = keptIndexes(relevance.experiences)
  const educationIndices = keptIndexes(relevance.education)
  // A skill is never excluded, whatever the model says, if the job posting quotes it word
  // for word or if it appears in a kept experience (RGAA, SEO…): it is evidenced there.
  const keptText = normalize(
    experienceIndices
      .flatMap((i) => (profile.experiences[i] ? [experienceText(profile.experiences[i])] : []))
      .join('\n'),
  )
  // Soft skills (rigour, autonomy, teamwork…) are useful in every job: always kept.
  const cited = new Set(
    profile.skills.flatMap((c, i) =>
      isSoftSkill(c) || isSkillCited(c, normalizedTerms) || isSkillCited(c, [keptText]) ? [i] : [],
    ),
  )
  const skillIndices = keptIndexes(relevance.skills, cited)

  // Chronological order of the profile kept in the CV; relevance sets the level of detail.
  // Sequential on purpose: a local model handles one request at a time.
  const experiences: TailoredExperience[] = []
  for (const index of experienceIndices) {
    const experience = profile.experiences[index]
    if (!experience) continue
    const maxPoints = relevance.experiences[index] === 2 ? PRIORITY_BULLETS : SECONDARY_BULLETS
    let bullets: string[]
    if (options.rewrite) {
      report({
        key: 'rewriting',
        label: 'Reformulation des expériences',
        current: experiences.length + 1,
        total: experienceIndices.length,
      })
      bullets = await rewriteExperience(engine, experience, analysis, maxPoints)
    } else {
      // Fast mode (default): the original bullets closest to the job posting are selected, without calling the model.
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

  // Coverage of the job posting requirements by the profile (reused below for the key skills).
  const coverage = analyzeCoverage(profile, analysis)

  // The summary must only talk about what answers the job posting. Neither the old summary of the profile (written for
  // another job) nor unrelated tasks: they gave « transformer des maquettes en sites web » to a recruitment job
  // posting. The model only receives the soft skills, the evidenced requirements and the achievements matching terms
  // of the job posting.
  const nearbyTerms = [...analysis.requiredSkills, ...analysis.softSkills, ...analysis.keywords, analysis.targetTitle]
  const summaryInput = {
    skills: withoutDuplicates([...coverage.evidenced.filter(isShortSkill), ...keptSkills.filter(isSoftSkill)]),
    achievements: experienceIndices.flatMap((i) =>
      profile.experiences[i] ? bulletsCloseToJob(profile.experiences[i], nearbyTerms, 3) : [],
    ),
  }
  report({ key: 'summary', label: 'Rédaction de l’accroche' })
  const written = await writeSummary(engine, summaryInput, analysis)

  // Guard in code (the prompt alone is not enough, especially against a booby-trapped job posting): a headline or a
  // summary quoting a job posting term absent from the profile, an unknown number or an excluded item is replaced by a
  // value taken from the profile.
  const source = verificationText(profile)
  const forbiddenTerms = [
    ...[...analysis.keywords, ...analysis.requiredSkills].filter(
      (term) => !containsWord(normalize(source), normalize(term)),
    ),
    ...excludedSkills,
    ...excludedExperiences.flatMap((e) => [e.position, e.company]),
  ]
  // Headline: the target job posting title (without « H/F », contract and company name), as is customary to pass the
  // first screening. Never written by the model. Fallback: profile headline, then the most relevant kept position.
  const rank = (index: number) => relevance.experiences[index] ?? 0
  const main = [...experiences].sort((a, b) => rank(b.sourceIndex ?? 0) - rank(a.sourceIndex ?? 0))[0]
  const title =
    cleanJobTitle(jobPosting.jobTitle, jobPosting.company) ||
    (hasExcluded ? main?.position : (profile.headline ?? main?.position)) ||
    ''
  const proposed = boundSummary(written.summary)
  // Allowed vocabulary: that of the job posting and of the data given to the model. A word coming from elsewhere
  // (« maquettes », « atelier ») is a drift towards the rest of the profile; at most one deviation is tolerated.
  const vocabulary = [jobPosting.rawText, ...nearbyTerms, ...summaryInput.skills, ...summaryInput.achievements].join(
    ' ',
  )
  const summaryIsFaithful =
    proposed !== '' &&
    isBulletFaithful(proposed, source, forbiddenTerms) &&
    durationsAreFaithful(proposed, source) &&
    unsupportedWords(proposed, vocabulary).length <= 1
  // Fallback: sentence of evidenced qualities requested by the job posting, then other soft skills of the profile.
  // Never the old summary of the profile, often written for another job.
  const evidencedSoftSkills = summaryInput.skills.filter(isSoftSkill).slice(0, 4)
  const softSkillsFallbackSummary = softSkillsSentence(evidencedSoftSkills)
  const shortEvidenced = coverage.evidenced.filter((t) => t.split(/\s+/).length <= 3).slice(0, 4)
  const jobFallbackSummary =
    shortEvidenced.length > 0 ? `Je mets en avant mes compétences en ${shortEvidenced.join(', ')}.` : ''
  const summary = summaryIsFaithful ? proposed : softSkillsFallbackSummary || jobFallbackSummary

  const listed = prioritizeSkills(keptSkills, jobTerms)
  // Key skills: those requested by the job posting and evidenced by the profile, worded as in the job posting (it is
  // what an ATS looks for). Removed from the general list so as not to appear twice.
  const shortRequested = coverage.evidenced.filter(isShortSkill).map(formatSkill)
  // Requested qualities (« autonomie », « sens du conseil ») go on the soft skills line, not among the tools.
  const keySkills = shortRequested
    .filter((t) => !isSoftSkill(t))
    .filter((t, i, all) => all.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, MAX_KEY_SKILLS)
  const general = listed.filter((c) => !isAlreadyListed(c, keySkills) || isSoftSkill(c))
  // Readability: soft skills first, then tools and techniques, capped.
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
