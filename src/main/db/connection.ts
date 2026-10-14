import { renameSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { DatabaseTooNewError, migrate } from './migrations'
import * as schema from './schema'

export type AppDatabase = BetterSQLite3Database<typeof schema> & { close: () => void }

/** `path`: SQLite file, or `:memory:` for tests. */
export function openDatabase(path: string): AppDatabase {
  const sqlite = new Database(path)
  try {
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    // Deleted content is overwritten with zeros instead of lingering in free pages (personal data).
    sqlite.pragma('secure_delete = ON')
    // Versioned schema (no drizzle-kit: the schema stays small), see migrations.ts.
    migrate(sqlite)
  } catch (error) {
    // Released so that the file can be moved aside (Windows locks open files).
    sqlite.close()
    throw error
  }
  return Object.assign(drizzle(sqlite, { schema }), { close: () => sqlite.close() })
}

/**
 * Opens the database; an unreadable file (corrupted, not SQLite) is renamed `<file>.unreadable-<date>` and replaced
 * by an empty database, so the app still starts. The backup is kept for a possible manual recovery.
 */
export function openDatabaseSafely(path: string): { db: AppDatabase; backupPath: string | null } {
  try {
    return { db: openDatabase(path), backupPath: null }
  } catch (error) {
    // Readable, but written by a newer Re:CV: never set aside (going back to an older version must not lose data).
    if (error instanceof DatabaseTooNewError) throw error
    const backupPath = `${path}.unreadable-${new Date().toISOString().replace(/[:.]/g, '-')}`
    renameSync(path, backupPath)
    for (const journalFile of [`${path}-wal`, `${path}-shm`]) rmSync(journalFile, { force: true })
    return { db: openDatabase(path), backupPath }
  }
}
