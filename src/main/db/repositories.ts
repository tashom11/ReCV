import type { JobPosting, Profile, TailoredCv } from '@core/schemas'
import { desc, eq, sql } from 'drizzle-orm'
import type { AppDatabase } from './connection'
import { jobPostings, profiles, tailoredCvs } from './schema'

/** A single active profile: the most recently saved one. */
export function getActiveProfile(db: AppDatabase): { id: number; profile: Profile } | null {
  const row = db.select().from(profiles).orderBy(desc(profiles.id)).limit(1).get()
  return row ? { id: row.id, profile: row.data } : null
}

/** New active profile: the previous profiles are kept until `purgeOldData` removes those no creation depends on. */
export function createProfile(db: AppDatabase, profile: Profile): { id: number; profile: Profile } {
  const [created] = db.insert(profiles).values({ data: profile }).returning({ id: profiles.id }).all()
  if (!created) throw new Error('Échec de l’enregistrement du profil')
  return { id: created.id, profile: profile }
}

/** Erases all personal data (order required by the foreign keys). */
export function eraseData(db: AppDatabase): void {
  db.delete(tailoredCvs).run()
  db.delete(jobPostings).run()
  db.delete(profiles).run()
  // The write-ahead log still holds the deleted rows: rebuild the file, then empty the log.
  db.run(sql`VACUUM`)
  db.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`)
}

/**
 * Data minimisation: keeps the active profile and the `keepCreations` most recent tailored CVs (with their job
 * postings and the profiles they were made from). Everything older is deleted (and overwritten: secure_delete).
 */
export function purgeOldData(db: AppDatabase, { keepCreations }: { keepCreations: number }): void {
  db.transaction((tx) => {
    tx.run(
      sql`DELETE FROM tailored_cvs WHERE id NOT IN (SELECT id FROM tailored_cvs ORDER BY id DESC LIMIT ${keepCreations})`,
    )
    tx.run(sql`DELETE FROM job_postings WHERE id NOT IN (SELECT job_posting_id FROM tailored_cvs)`)
    tx.run(
      sql`DELETE FROM profiles WHERE id <> (SELECT MAX(id) FROM profiles) AND id NOT IN (SELECT profile_id FROM tailored_cvs)`,
    )
  })
}

/** Updates the active profile if there is one, otherwise creates it. */
export function saveProfile(db: AppDatabase, profile: Profile): { id: number; profile: Profile } {
  const active = getActiveProfile(db)
  const updatedAt = new Date().toISOString()
  if (active) {
    db.update(profiles).set({ data: profile, updatedAt }).where(eq(profiles.id, active.id)).run()
    return { id: active.id, profile: profile }
  }
  const [created] = db.insert(profiles).values({ data: profile, updatedAt }).returning({ id: profiles.id }).all()
  if (!created) throw new Error('Échec de l’enregistrement du profil')
  return { id: created.id, profile: profile }
}

export function saveJobPosting(db: AppDatabase, jobPosting: JobPosting, url?: string): number {
  const [created] = db.insert(jobPostings).values({ data: jobPosting, url }).returning({ id: jobPostings.id }).all()
  if (!created) throw new Error('Échec de l’enregistrement de l’offre')
  return created.id
}

export function saveTailoredCv(db: AppDatabase, profileId: number, jobPostingId: number, cv: TailoredCv): number {
  const [created] = db
    .insert(tailoredCvs)
    .values({ profileId, jobPostingId, data: cv })
    .returning({ id: tailoredCvs.id })
    .all()
  if (!created) throw new Error('Échec de l’enregistrement du CV')
  return created.id
}
