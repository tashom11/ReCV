import type { Experience } from '../schemas'

// Comparaisons de texte insensibles à la casse et aux accents, utilisées par les garde-fous anti-invention.

export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Vrai si `mot` apparaît dans `texte` comme mot entier (« C » ne correspond pas à « React »).
export function contientMot(texte: string, mot: string): boolean {
  if (mot.length === 0) return false
  const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${echappe}($|[^\\p{L}\\p{N}])`, 'u').test(texte)
}

// Nombres cités (« 50 000 », « 30 % », « 2021 ») réduits à leurs chiffres.
export function nombres(texte: string): string[] {
  return (texte.match(/\d[\d\s.,]*/g) ?? []).map((nombre) => nombre.replace(/\D/g, ''))
}

// Tout le texte source d'une expérience : référence pour vérifier ce que le LLM a le droit de citer.
export function texteExperience(experience: Experience): string {
  return [experience.poste, experience.description ?? '', ...experience.realisations].join('\n')
}
