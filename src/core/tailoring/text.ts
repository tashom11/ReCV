import type { Experience } from '../schemas'

// Comparaisons de texte insensibles à la casse et aux accents, utilisées par les garde-fous anti-invention.

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Vrai si `mot` apparaît dans `texte` comme mot entier (« C » ne correspond pas à « React »).
export function containsWord(text: string, word: string): boolean {
  if (word.length === 0) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(text)
}

// Nombres cités (« 50 000 », « 30 % », « 2021 ») réduits à leurs chiffres.
export function numbers(text: string): string[] {
  return (text.match(/\d[\d\s.,]*/g) ?? []).map((count) => count.replace(/\D/g, ''))
}

// Tout le texte source d'une expérience : référence pour vérifier ce que le LLM a le droit de citer.
export function experienceText(experience: Experience): string {
  return [experience.position, experience.description ?? '', ...experience.achievements].join('\n')
}
