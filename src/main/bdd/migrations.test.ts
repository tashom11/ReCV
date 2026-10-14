import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabaseSafely, ouvrirBdd } from './connexion'
import { obtenirProfilActif } from './depots'
import { DatabaseTooNewError, LATEST_VERSION, type Migration, migrate } from './migrations'

let dossier: string
beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'recv-migr-'))
})
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true })
})

const version = (sqlite: Database.Database) => sqlite.pragma('user_version', { simple: true })

// Exactly what v0.2.1 created: tables without any version number.
const SCHEMA_V0_2_1 = `
  CREATE TABLE IF NOT EXISTS profils (id INTEGER PRIMARY KEY AUTOINCREMENT, donnees TEXT NOT NULL, mis_a_jour TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS offres (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, donnees TEXT NOT NULL, cree_le TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS cv_generes (id INTEGER PRIMARY KEY AUTOINCREMENT, profil_id INTEGER NOT NULL REFERENCES profils(id),
    offre_id INTEGER NOT NULL REFERENCES offres(id), donnees TEXT NOT NULL, cree_le TEXT NOT NULL);
`

describe('migrate', () => {
  it('brings a new database to the latest version', () => {
    const sqlite = new Database(':memory:')
    migrate(sqlite)
    expect(version(sqlite)).toBe(LATEST_VERSION)
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'profils'").get()).toBeDefined()
  })

  it('keeps the data of a v0.2.1 database', () => {
    const chemin = join(dossier, 'recv.db')
    const ancienne = new Database(chemin)
    ancienne.exec(SCHEMA_V0_2_1)
    ancienne
      .prepare('INSERT INTO profils (donnees, mis_a_jour) VALUES (?, ?)')
      .run(JSON.stringify({ nom: 'Camille Martin', experiences: [], competences: [] }), '2026-10-13T10:00:00.000Z')
    ancienne.close()

    const bdd = ouvrirBdd(chemin)
    expect(obtenirProfilActif(bdd)?.profile.fullName).toBe('Camille Martin')
    bdd.fermer()
    const relue = new Database(chemin)
    expect(version(relue)).toBe(LATEST_VERSION)
    relue.close()
  })

  it('runs only the migrations not applied yet, in order', () => {
    const sqlite = new Database(':memory:')
    const appliquees: number[] = []
    const migrations: Migration[] = [1, 2, 3].map((v) => ({ version: v, up: () => void appliquees.push(v) }))
    sqlite.pragma('user_version = 1')

    migrate(sqlite, migrations)
    migrate(sqlite, migrations)

    expect(appliquees).toEqual([2, 3])
    expect(version(sqlite)).toBe(3)
  })

  it('leaves the database untouched when a migration fails', () => {
    const sqlite = new Database(':memory:')
    const migrations: Migration[] = [
      { version: 1, up: (db) => db.exec('CREATE TABLE a (x)') },
      {
        version: 2,
        up: (db) => {
          db.exec('CREATE TABLE b (x)')
          throw new Error('boom')
        },
      },
    ]

    expect(() => migrate(sqlite, migrations)).toThrow('boom')
    expect(version(sqlite)).toBe(0)
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name IN ('a', 'b')").all()).toEqual([])
  })

  it('refuses a database written by a newer Re:CV, instead of treating it as unreadable', () => {
    const chemin = join(dossier, 'recv.db')
    const future = new Database(chemin)
    future.pragma(`user_version = ${LATEST_VERSION + 1}`)
    future.close()

    expect(() => openDatabaseSafely(chemin)).toThrow(DatabaseTooNewError)
  })
})
