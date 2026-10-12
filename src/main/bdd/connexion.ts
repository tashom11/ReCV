import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Bdd = BetterSQLite3Database<typeof schema> & { fermer: () => void }

// Création idempotente des tables (pas de drizzle-kit : le schéma reste minimal).
const CREATION = `
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
`

/** `chemin` : fichier SQLite, ou `:memory:` pour les tests. */
export function ouvrirBdd(chemin: string): Bdd {
  const sqlite = new Database(chemin)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(CREATION)
  return Object.assign(drizzle(sqlite, { schema }), { fermer: () => sqlite.close() })
}
