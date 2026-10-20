// Rebuilds src/core/places/places.json, the list of French communes and departments behind the suggestions of the
// "Ville ou département" field. Run by a maintainer when the list needs refreshing (new communes merge every
// January); the app itself never calls a service: the list ships with it.
//
//   node scripts/build-places.mjs
//
// Source: geo.api.gouv.fr (Etalab, based on INSEE's official geographical code), Licence Ouverte 2.0.
// Communes are sorted by population, largest first: the search keeps the first matches, so « Mar » suggests
// Marseille before Marly.
import { writeFile } from 'node:fs/promises'

const API = 'https://geo.api.gouv.fr'

async function get(path) {
  const response = await fetch(`${API}${path}`)
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}

const clean = (text) => text.replace(/[\t\n]/g, ' ').trim()

const [communes, departments] = await Promise.all([
  get('/communes?fields=nom,codeDepartement,population&format=json&zone=metro,drom,com'),
  get('/departements?fields=nom,code'),
])

const lines = (rows) => rows.map(([name, code]) => `${clean(name)}\t${code}`).join('\n')

const output = {
  source: 'geo.api.gouv.fr (Etalab / INSEE), Licence Ouverte 2.0',
  date: new Date().toISOString().slice(0, 10),
  // One « name<TAB>department » line per commune: far lighter to parse than 35,000 small objects.
  communes: lines(
    communes
      .filter((c) => c.nom && c.codeDepartement)
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.nom.localeCompare(b.nom, 'fr'))
      .map((c) => [c.nom, c.codeDepartement]),
  ),
  departments: lines(
    departments.sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true })).map((d) => [d.nom, d.code]),
  ),
}

await writeFile(new URL('../src/core/places/places.json', import.meta.url), `${JSON.stringify(output)}\n`)
process.stdout.write(`${communes.length} communes, ${departments.length} departments\n`)
