import type { Requirements } from '@core/schemas'

/** What the job posting wishes for and the CV does not show: said without discouraging. */
export function goodToKnow(requirements: Requirements): string | null {
  const sentences: string[] = []
  if (requirements.experience?.status === 'not-found') {
    sentences.push(`l’annonce souhaite « ${requirements.experience.required} ». Cela n’apparaît pas dans votre CV`)
  }
  if (requirements.education?.status === 'insufficient') {
    const profile = requirements.education.profileValue
      ? ` (votre CV indique « ${requirements.education.profileValue} »)`
      : ''
    sentences.push(`l’annonce demande « ${requirements.education.required} »${profile}`)
  }
  if (sentences.length === 0) return null
  return `${sentences.join(' ; ')}, mais cela ne vous empêche pas de postuler.`
}
