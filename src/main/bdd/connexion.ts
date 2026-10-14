import { renameSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { DatabaseTooNewError, migrate } from './migrations'
import * as schema from './schema'

export type Bdd = BetterSQLite3Database<typeof schema> & { fermer: () => void }

/** `chemin` : fichier SQLite, ou `:memory:` pour les tests. */
export function ouvrirBdd(chemin: string): Bdd {
  const sqlite = new Database(chemin)
  try {
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    // Deleted content is overwritten with zeros instead of lingering in free pages (personal data).
    sqlite.pragma('secure_delete = ON')
    // Versioned schema (no drizzle-kit: the schema stays small), see migrations.ts.
    migrate(sqlite)
  } catch (erreur) {
    // Released so that the file can be moved aside (Windows locks open files).
    sqlite.close()
    throw erreur
  }
  return Object.assign(drizzle(sqlite, { schema }), { fermer: () => sqlite.close() })
}

/**
 * Opens the database; an unreadable file (corrupted, not SQLite) is renamed `<file>.unreadable-<date>` and replaced
 * by an empty database, so the app still starts. The backup is kept for a possible manual recovery.
 */
export function openDatabaseSafely(chemin: string): { bdd: Bdd; backupPath: string | null } {
  try {
    return { bdd: ouvrirBdd(chemin), backupPath: null }
  } catch (erreur) {
    // Readable, but written by a newer Re:CV: never set aside (going back to an older version must not lose data).
    if (erreur instanceof DatabaseTooNewError) throw erreur
    const backupPath = `${chemin}.unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}`
    renameSync(chemin, backupPath)
    for (const journal of [`${chemin}-wal`, `${chemin}-shm`]) rmSync(journal, { force: true })
    return { bdd: ouvrirBdd(chemin), backupPath }
  }
}
