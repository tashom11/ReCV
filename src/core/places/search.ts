// Suggestions for the « Ville ou département » field: French communes and departments, searched on the list that ships
// with the app (scripts/build-places.mjs). Pure: the list is given, nothing is fetched.

export interface Place {
  /** Name as written (« Lyon », « Rhône »). */
  name: string
  /** Unique per place, « Lyon (69) »: two communes can share a name. */
  label: string
  kind: 'commune' | 'department'
  /** Name without accents, case or punctuation: what the query is compared with. */
  key: string
  /** Department code, as written (« 01 », « 2A », « 971 »). */
  code: string
}

export interface RawPlaces {
  /** One « name<TAB>department code » line per commune, largest population first. */
  communes: string
  /** Same, ordered by code. */
  departments: string
}

/** « Saint-Étienne » → « saint etienne »: the comparison ignores case, accents, hyphens and apostrophes. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parse(lines: string, kind: Place['kind']): Place[] {
  return lines
    .split('\n')
    .filter((line) => line.includes('\t'))
    .map((line) => {
      const [name = '', code = ''] = line.split('\t')
      return { name, label: `${name} (${code})`, kind, key: fold(name), code }
    })
}

export interface PlaceIndex {
  communes: Place[]
  departments: Place[]
}

export function createPlaceIndex(raw: RawPlaces): PlaceIndex {
  return { communes: parse(raw.communes, 'commune'), departments: parse(raw.departments, 'department') }
}

const DEFAULT_LIMIT = 6
// « Lyon (69) », « Lyon 69 », « Lyon, 69 »: a trailing department code narrows the commune.
const TRAILING_CODE = /^(.*\D)\s+(\d{2,3}|2a|2b)$/

/**
 * Places matching what the user typed, best first:
 * - digits or « 2A »: the departments with this code, then the largest communes of the one that matches exactly;
 * - a name: exact name, then names starting with it, then names with a word starting with it (« etienne » finds
 *   « Saint-Étienne »). A department comes before a commune at equal rank, communes follow the order of the list
 *   (largest first). Text after a comma (« Lyon, France ») is ignored.
 */
export function searchPlaces(index: PlaceIndex, query: string, limit = DEFAULT_LIMIT): Place[] {
  const typed = fold(query.split(',')[0] ?? '')
  if (typed === '') return []

  if (/^(\d{1,3}|2a|2b)$/.test(typed)) return searchByCode(index, typed, limit)

  const withCode = TRAILING_CODE.exec(typed)
  const text = withCode?.[1]?.trim() ?? typed
  const code = withCode?.[2]
  const inDepartment = (place: Place) => code === undefined || place.code.toLowerCase() === code

  const rank = (place: Place) =>
    place.key === text
      ? 'exact'
      : place.key.startsWith(text)
        ? 'prefix'
        : place.key.includes(` ${text}`)
          ? 'word'
          : undefined
  const match = (places: Place[]) => {
    const found: Record<'exact' | 'prefix' | 'word', Place[]> = { exact: [], prefix: [], word: [] }
    for (const place of places) {
      const level = inDepartment(place) ? rank(place) : undefined
      // A level never needs more than the limit: the list is already in order of importance.
      if (level && found[level].length < limit) found[level].push(place)
    }
    return found
  }
  const departments = match(index.departments)
  const communes = match(index.communes)
  // A complete name is the one wanted, a department first (« Rhône »); for a beginning of word, a city is more likely
  // than a department (« mar »: Marseille before Marne).
  return unique([
    ...departments.exact,
    ...communes.exact,
    ...communes.prefix,
    ...departments.prefix,
    ...communes.word,
    ...departments.word,
  ]).slice(0, limit)
}

function searchByCode(index: PlaceIndex, code: string, limit: number): Place[] {
  const wanted = code.toLowerCase()
  const departments = index.departments.filter((d) => d.code.toLowerCase().startsWith(wanted))
  const exactDepartment = departments.find((d) => d.code.toLowerCase() === wanted)
  const communes = exactDepartment ? index.communes.filter((c) => c.code === exactDepartment.code) : []
  return unique([...departments, ...communes]).slice(0, limit)
}

// « Paris (75) » is both a commune and a department: shown once.
function unique(places: Place[]): Place[] {
  const seen = new Set<string>()
  return places.filter((place) => !seen.has(place.label) && seen.add(place.label))
}
