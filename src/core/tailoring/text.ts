import type { Experience } from '../schemas'

// Case- and accent-insensitive text comparisons, used by the no-fabrication guards.

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// True if `word` appears in `text` as a whole word (« C » does not match « React »).
export function containsWord(text: string, word: string): boolean {
  if (word.length === 0) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text)
}

// Quoted numbers (« 50 000 », « 30 % », « 2021 ») reduced to their digits.
export function numbers(text: string): string[] {
  return (text.match(/\d[\d\s.,]*/g) ?? []).map((count) => count.replace(/\D/g, ''))
}

// All the source text of an experience: reference to check what the LLM may quote.
export function experienceText(experience: Experience): string {
  return [experience.position, experience.description ?? '', ...experience.achievements].join('\n')
}
