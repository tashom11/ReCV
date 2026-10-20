import { describe, expect, it } from 'vitest'
import { createPlaceIndex, fold, searchPlaces, suggestPlaces } from './index'

const labels = (places: { label: string }[]) => places.map((p) => p.label)

describe('fold', () => {
  it('ignores case, accents, hyphens, apostrophes and ligatures', () => {
    expect(fold('Saint-Étienne')).toBe('saint etienne')
    expect(fold("L'Haÿ-les-Roses")).toBe('l hay les roses')
    expect(fold('Marcq-en-Barœul')).toBe('marcq en baroeul')
  })
})

// Small list in the format of the shipped one: largest communes first.
const index = createPlaceIndex({
  communes: [
    'Paris\t75',
    'Lyon\t69',
    'Saint-Étienne\t42',
    'Villeurbanne\t69',
    'Lyons-la-Forêt\t27',
    'Saint-Denis\t93',
    'Saint-Denis\t974',
  ].join('\n'),
  departments: [
    'Loire\t42',
    'Rhône\t69',
    'Paris\t75',
    'Seine-Saint-Denis\t93',
    'Corse-du-Sud\t2A',
    'La Réunion\t974',
  ].join('\n'),
})

describe('searchPlaces', () => {
  it('suggests nothing for an empty query', () => {
    expect(searchPlaces(index, '')).toEqual([])
    expect(searchPlaces(index, '   ')).toEqual([])
  })

  it('puts an exact name first, then names starting with the query, largest commune first', () => {
    expect(labels(searchPlaces(index, 'lyon'))).toEqual(['Lyon (69)', 'Lyons-la-Forêt (27)'])
    expect(labels(searchPlaces(index, 'sai'))).toEqual([
      'Saint-Étienne (42)',
      'Saint-Denis (93)',
      'Saint-Denis (974)',
      'Seine-Saint-Denis (93)',
    ])
  })

  it('finds a name from one of its words, with or without accents and hyphens', () => {
    expect(labels(searchPlaces(index, 'etienne'))).toEqual(['Saint-Étienne (42)'])
    expect(labels(searchPlaces(index, 'saint etienne'))).toEqual(['Saint-Étienne (42)'])
    expect(labels(searchPlaces(index, 'foret'))).toEqual(['Lyons-la-Forêt (27)'])
  })

  it('lists a department before a commune of the same rank, and shows a shared name once', () => {
    expect(labels(searchPlaces(index, 'paris'))).toEqual(['Paris (75)'])
    expect(labels(searchPlaces(index, 'rhone'))).toEqual(['Rhône (69)'])
  })

  it('finds a department from its code, then the largest communes of that department', () => {
    expect(labels(searchPlaces(index, '69'))).toEqual(['Rhône (69)', 'Lyon (69)', 'Villeurbanne (69)'])
    expect(labels(searchPlaces(index, '2a'))).toEqual(['Corse-du-Sud (2A)'])
    expect(labels(searchPlaces(index, '97'))).toEqual(['La Réunion (974)'])
  })

  it('narrows a commune with the department written after it', () => {
    expect(labels(searchPlaces(index, 'Saint-Denis (93)'))).toEqual(['Saint-Denis (93)', 'Seine-Saint-Denis (93)'])
    expect(labels(searchPlaces(index, 'saint denis 974'))).toEqual(['Saint-Denis (974)'])
  })

  it('ignores what follows a comma (« Lyon, France »)', () => {
    expect(labels(searchPlaces(index, 'Lyon, France'))[0]).toBe('Lyon (69)')
  })

  it('respects the limit', () => {
    expect(searchPlaces(index, 'sai', 2)).toHaveLength(2)
  })
})

// What the field shows and receives: « Lyon » with its code next to it, « Rhône (69) » for a department.
const shown = async (query: string) =>
  (await suggestPlaces(query)).map((s) => `${s.value} | ${s.kind === 'department' ? 'département' : s.code}`)

describe('shipped list', () => {
  it('suggests the large cities first, whatever the accents', async () => {
    expect((await shown('lyo'))[0]).toBe('Lyon | 69')
    expect((await shown('mar'))[0]).toBe('Marseille | 13')
    expect((await shown('saint etienne'))[0]).toBe('Saint-Étienne | 42')
    expect(await shown('rhone')).toContain('Rhône (69) | département')
    expect((await shown('69')).slice(0, 2)).toEqual(['Rhône (69) | département', 'Lyon | 69'])
  })

  it('tells communes of the same name apart by their department', async () => {
    const denis = (await shown('saint denis')).filter((line) => line.startsWith('Saint-Denis |'))
    expect(denis.length).toBeGreaterThan(1)
    expect(new Set(denis).size).toBe(denis.length)
  })

  it('covers the overseas departments and Corsica', async () => {
    expect(await shown('971')).toContain('Guadeloupe (971) | département')
    expect((await shown('ajacc'))[0]).toBe('Ajaccio | 2A')
  })

  it('answers fast enough to be used at each keystroke', async () => {
    await suggestPlaces('a')
    const start = performance.now()
    for (const query of ['s', 'sa', 'sai', 'saint', 'saint e']) await suggestPlaces(query)
    expect(performance.now() - start).toBeLessThan(500)
  })
})
