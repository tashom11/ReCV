import { createPlaceIndex, type PlaceIndex, searchPlaces } from './search'

export { createPlaceIndex, fold, type Place, type PlaceIndex, type RawPlaces, searchPlaces } from './search'

let loading: Promise<PlaceIndex> | undefined

// The list (about 600 kB) is loaded on first use, not at startup, and kept.
function loadPlaces(): Promise<PlaceIndex> {
  loading ??= import('./places.json').then((module) => createPlaceIndex(module.default))
  return loading
}

export interface PlaceSuggestion {
  /** What goes into the field: « Lyon » for a commune, « Rhône (69) » for a department. */
  value: string
  kind: 'commune' | 'department'
  /** Department code: to tell communes of the same name apart. */
  code: string
}

/** Suggestions for what the user has typed. Nothing leaves the computer. */
export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  return searchPlaces(await loadPlaces(), query).map((place) => ({
    value: place.kind === 'department' ? place.label : place.name,
    kind: place.kind,
    code: place.code,
  }))
}
