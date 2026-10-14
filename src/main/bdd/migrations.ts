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
        const rows = sqlite.prepare(`SELECT id, donnees FROM ${table}`).all() as { id: number; donnees: string }[]
        for (const { id, donnees } of rows) update.run(JSON.stringify(convert(JSON.parse(donnees))), id)
      }
    },
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
