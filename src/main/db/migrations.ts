import type Database from 'better-sqlite3'
import { jobPostingFromV1, profileFromV1, tailoredCvFromV1 } from './legacyData'

/**
 * A database schema change. Its `version` is stored in `PRAGMA user_version` once applied: every migration runs
 * exactly once per database, in order. Never edit a released migration: add a new one.
 */
export interface Migration {
  version: number
  up: (sqlite: Database.Database) => void
}

/** The database was written by a newer Re:CV: opening it here could damage it, so it is left untouched. */
export class DatabaseTooNewError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(`Database version ${found} is newer than the supported version ${supported}.`)
    this.name = 'DatabaseTooNewError'
  }
}

export const MIGRATIONS: readonly Migration[] = [
  {
    // Schema of v0.2.1 and earlier. `IF NOT EXISTS`: those databases already have these tables (version 0).
    version: 1,
    up: (sqlite) =>
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS profils (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          donnees TEXT NOT NULL,
          mis_a_jour TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS offres (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT,
          donnees TEXT NOT NULL,
          cree_le TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS cv_generes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profil_id INTEGER NOT NULL REFERENCES profils(id),
          offre_id INTEGER NOT NULL REFERENCES offres(id),
          donnees TEXT NOT NULL,
          cree_le TEXT NOT NULL
        );
      `),
  },
  {
    // Code moved to English: the JSON stored in `donnees` takes the English keys of the schemas.
    version: 2,
    up: (sqlite) => {
      const tables = [
        ['profils', profileFromV1],
        ['offres', jobPostingFromV1],
        ['cv_generes', tailoredCvFromV1],
      ] as const
      for (const [table, convert] of tables) {
        const update = sqlite.prepare(`UPDATE ${table} SET donnees = ? WHERE id = ?`)
        const rows = sqlite.prepare(`SELECT id, donnees AS data FROM ${table}`).all() as { id: number; data: string }[]
        for (const { id, data } of rows) update.run(JSON.stringify(convert(JSON.parse(data))), id)
      }
    },
  },
  {
    // English table and column names. SQLite updates the foreign keys that point to a renamed table or column.
    version: 3,
    up: (sqlite) =>
      sqlite.exec(`
        ALTER TABLE profils RENAME TO profiles;
        ALTER TABLE profiles RENAME COLUMN donnees TO data;
        ALTER TABLE profiles RENAME COLUMN mis_a_jour TO updated_at;
        ALTER TABLE offres RENAME TO job_postings;
        ALTER TABLE job_postings RENAME COLUMN donnees TO data;
        ALTER TABLE job_postings RENAME COLUMN cree_le TO created_at;
        ALTER TABLE cv_generes RENAME TO tailored_cvs;
        ALTER TABLE tailored_cvs RENAME COLUMN profil_id TO profile_id;
        ALTER TABLE tailored_cvs RENAME COLUMN offre_id TO job_posting_id;
        ALTER TABLE tailored_cvs RENAME COLUMN donnees TO data;
        ALTER TABLE tailored_cvs RENAME COLUMN cree_le TO created_at;
      `),
  },
]

export const LATEST_VERSION = Math.max(...MIGRATIONS.map((m) => m.version))

/** Applies the pending migrations in a single transaction: on failure, the database is left as it was. */
export function migrate(sqlite: Database.Database, migrations: readonly Migration[] = MIGRATIONS): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number
  const latest = Math.max(0, ...migrations.map((m) => m.version))
  if (current > latest) throw new DatabaseTooNewError(current, latest)
  const pending = migrations.filter((m) => m.version > current).sort((a, b) => a.version - b.version)
  if (pending.length === 0) return
  sqlite.transaction(() => {
    for (const migration of pending) {
      migration.up(sqlite)
      sqlite.pragma(`user_version = ${migration.version}`)
    }
  })()
}
