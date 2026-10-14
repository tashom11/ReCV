import type { JobPosting, Profile, TailoredCv } from '@core/schemas'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const maintenant = () => new Date().toISOString()

export const profils = sqliteTable('profils', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  donnees: text('donnees', { mode: 'json' }).$type<Profile>().notNull(),
  misAJour: text('mis_a_jour').notNull().$defaultFn(maintenant),
})

export const offres = sqliteTable('offres', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url'),
  donnees: text('donnees', { mode: 'json' }).$type<JobPosting>().notNull(),
  creeLe: text('cree_le').notNull().$defaultFn(maintenant),
})

export const cvGeneres = sqliteTable('cv_generes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profilId: integer('profil_id')
    .notNull()
    .references(() => profils.id),
  offreId: integer('offre_id')
    .notNull()
    .references(() => offres.id),
  donnees: text('donnees', { mode: 'json' }).$type<TailoredCv>().notNull(),
  creeLe: text('cree_le').notNull().$defaultFn(maintenant),
})
