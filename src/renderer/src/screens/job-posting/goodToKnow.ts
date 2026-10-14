import type { Requirements } from '@core/schemas'
import { texts } from '../../i18n'

/** What the job posting wishes for and the CV does not show: said without discouraging. */
export function goodToKnow(requirements: Requirements): string | null {
  const words = texts.jobPosting.goodToKnow
  const sentences: string[] = []
  if (requirements.experience?.status === 'not-found') {
    sentences.push(words.experienceNotFound(requirements.experience.required))
  }
  if (requirements.education?.status === 'insufficient') {
    const profile = requirements.education.profileValue
      ? words.profileEducation(requirements.education.profileValue)
      : ''
    sentences.push(`${words.educationInsufficient(requirements.education.required)}${profile}`)
  }
  if (sentences.length === 0) return null
  return words.conclusion(sentences.join(words.separator))
}
