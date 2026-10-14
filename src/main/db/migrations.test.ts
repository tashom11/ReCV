import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, openDatabaseSafely } from './connection'
import { DatabaseTooNewError, LATEST_VERSION, type Migration, migrate } from './migrations'
import { getActiveProfile } from './repositories'

let folder: string
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'recv-migr-'))
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
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
    expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'profiles'").get()).toBeDefined()
  })

  it('keeps the data of a v0.2.1 database', () => {
    const path = join(folder, 'recv.db')
    const previousDb = new Database(path)
    previousDb.exec(SCHEMA_V0_2_1)
    previousDb
      .prepare('INSERT INTO profils (donnees, mis_a_jour) VALUES (?, ?)')
      .run(JSON.stringify({ nom: 'Camille Martin', experiences: [], competences: [] }), '2026-10-13T10:00:00.000Z')
    previousDb.close()

    const db = openDatabase(path)
    expect(getActiveProfile(db)?.profile.fullName).toBe('Camille Martin')
    db.close()
    const reread = new Database(path)
    expect(version(reread)).toBe(LATEST_VERSION)
    reread.close()
  })

  it('gives the tables and columns English names, keeping rows and links', () => {
    const path = join(folder, 'recv.db')
    const previousDb = new Database(path)
    previousDb.exec(SCHEMA_V0_2_1)
    previousDb.prepare('INSERT INTO profils (donnees, mis_a_jour) VALUES (?, ?)').run('{"nom":"A"}', 't1')
    previousDb
      .prepare('INSERT INTO offres (url, donnees, cree_le) VALUES (?, ?, ?)')
      .run('u', '{"titrePoste":"T"}', 't2')
    previousDb
      .prepare('INSERT INTO cv_generes (profil_id, offre_id, donnees, cree_le) VALUES (1, 1, ?, ?)')
      .run('{"titre":"T"}', 't3')
    previousDb.close()

    openDatabase(path).close()

    const reread = new Database(path)
    const columns = (table: string) =>
      (reread.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
    expect(columns('profiles')).toEqual(['id', 'data', 'updated_at'])
    expect(columns('job_postings')).toEqual(['id', 'url', 'data', 'created_at'])
    expect(columns('tailored_cvs')).toEqual(['id', 'profile_id', 'job_posting_id', 'data', 'created_at'])
    expect(reread.prepare('SELECT profile_id, job_posting_id, created_at FROM tailored_cvs').get()).toEqual({
      profile_id: 1,
      job_posting_id: 1,
      created_at: 't3',
    })
    expect(
      reread.prepare("SELECT name FROM sqlite_master WHERE name IN ('profils', 'offres', 'cv_generes')").all(),
    ).toEqual([])
    reread.close()
  })

  it('runs only the migrations not applied yet, in order', () => {
    const sqlite = new Database(':memory:')
    const applied: number[] = []
    const migrations: Migration[] = [1, 2, 3].map((v) => ({ version: v, up: () => void applied.push(v) }))
    sqlite.pragma('user_version = 1')

    migrate(sqlite, migrations)
    migrate(sqlite, migrations)

    expect(applied).toEqual([2, 3])
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
    const path = join(folder, 'recv.db')
    const future = new Database(path)
    future.pragma(`user_version = ${LATEST_VERSION + 1}`)
    future.close()

    expect(() => openDatabaseSafely(path)).toThrow(DatabaseTooNewError)
  })
})
