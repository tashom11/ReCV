import type { Parametres } from '@core/api'

// Choices (engine, model level, rewriting) are saved as soon as they are made; text fields wait for the button,
// since a half-typed address is not valid yet. The model file path is both: chosen by the level radios (saved at
// once, so it matches again right away) or typed in the advanced field.
const TEXT_FIELDS = [
  'urlOllama',
  'modeleOllama',
  'urlApi',
  'modeleApi',
  'cheminModeleLocal',
] as const satisfies (keyof Parametres)[]

/** True when an advanced text field or an API key has been typed but not saved yet. */
export function hasUnsavedTextChanges(saved: Parametres, draft: Parametres, typedApiKey: string): boolean {
  return typedApiKey.trim() !== '' || TEXT_FIELDS.some((field) => saved[field] !== draft[field])
}
