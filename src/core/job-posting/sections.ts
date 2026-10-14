import { cleanJobPostingText, isHeading, prepareJobPostingText } from './text'

/**
 * Sections of a job posting. The « profil recherché » (candidate profile) section is the most useful to tailor a CV:
 * that is where the employer lists the expected education, experience, tools and qualities. It must never be drowned
 * (nor truncated) in the rest of the posting.
 */
export interface JobPostingSections {
  profile: string
  missions: string
  rest: string
}

const PROFILE_HEADING =
  /^(profil( recherch[ée]s?)?|votre profil|le profil|profil du candidat|vous [êe]tes|ce que nous attendons( de vous)?|ce que nous recherchons|comp[ée]tences( requises| attendues| recherch[ée]es)?|qualit[ée]s( requises| attendues)?|pr[ée]-?requis|savoir-[êe]tre|exp[ée]rience et comp[ée]tences|vos comp[ée]tences|votre bagage|votre exp[ée]rience)\s*:?$/iu

const MISSIONS_HEADING =
  /^(missions?( principales?)?|vos missions|les missions|description (du poste|de la mission)|le poste|vos activit[ée]s( principales)?|activit[ée]s( principales)?|vos responsabilit[ée]s|responsabilit[ée]s|votre r[ôo]le|ce que vous ferez|au quotidien)\s*:?$/iu

const withoutSymbols = (line: string) => line.trim().replace(/^[^\p{L}\p{N}]+/u, '')

export function extractSections(text: string): JobPostingSections {
  const sections: Record<keyof JobPostingSections, string[]> = { profile: [], missions: [], rest: [] }
  let currentStep: keyof JobPostingSections = 'rest'
  for (const line of cleanJobPostingText(text).split('\n')) {
    const l = withoutSymbols(line)
    if (PROFILE_HEADING.test(l)) {
      currentStep = 'profile'
      continue
    }
    if (MISSIONS_HEADING.test(l)) {
      currentStep = 'missions'
      continue
    }
    // Another section heading closes the current section (back to the « rest »).
    if (isHeading(line, true) && currentStep !== 'rest') currentStep = 'rest'
    sections[currentStep].push(line)
  }
  const joinNonEmpty = (lines: string[]) =>
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  return {
    profile: joinNonEmpty(sections.profile),
    missions: joinNonEmpty(sections.missions),
    rest: joinNonEmpty(sections.rest),
  }
}

const MAX_PROFILE_LENGTH = 2000
const MAX_MISSIONS_LENGTH = 2200

/**
 * Text given to the model to analyse the job posting: the « profil recherché » section first and in full (up to
 * 2,000 characters), then missions and context, capped. Without a recognised section: cleaned and capped text.
 */
export function prepareAnalysisText(text: string): string {
  const { profile, missions, rest } = extractSections(text)
  if (profile === '') return prepareJobPostingText(text)
  const cut = (t: string, max: number) =>
    t.length <= max ? t : t.slice(0, t.lastIndexOf('\n', max) > 0 ? t.lastIndexOf('\n', max) : max)
  const context = cut([missions, rest].filter(Boolean).join('\n\n'), MAX_MISSIONS_LENGTH)
  return `PROFIL RECHERCHÉ :\n${cut(profile, MAX_PROFILE_LENGTH)}${context ? `\n\nMISSIONS ET CONTEXTE :\n${context}` : ''}`
}
