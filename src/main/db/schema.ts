import type { JobPosting, Profile, TailoredCv } from '@core/schemas'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const now = () => new Date().toISOString()

export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  data: text('data', { mode: 'json' }).$type<Profile>().notNull(),
  updatedAt: text('updated_at').notNull().$defaultFn(now),
})

export const jobPostings = sqliteTable('job_postings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url'),
  data: text('data', { mode: 'json' }).$type<JobPosting>().notNull(),
  createdAt: text('created_at').notNull().$defaultFn(now),
})

export const tailoredCvs = sqliteTable('tailored_cvs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id')
    .notNull()
    .references(() => profiles.id),
  jobPostingId: integer('job_posting_id')
    .notNull()
    .references(() => jobPostings.id),
  data: text('data', { mode: 'json' }).$type<TailoredCv>().notNull(),
  createdAt: text('created_at').notNull().$defaultFn(now),
})
