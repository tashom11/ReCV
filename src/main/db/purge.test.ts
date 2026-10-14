import { jobPostingSchema, profileSchema, tailoredCvSchema } from '@core/schemas'
import { describe, expect, it } from 'vitest'
import { openDatabase } from './connection'
import { createProfile, getActiveProfile, purgeOldData, saveJobPosting, saveTailoredCv } from './repositories'
import { jobPostings, profiles, tailoredCvs } from './schema'

const profile = (name: string) => profileSchema.parse({ fullName: name })
const jobPosting = (titrePoste: string) =>
  jobPostingSchema.parse({ jobTitle: titrePoste, rawText: `Annonce ${titrePoste}` })
const cv = tailoredCvSchema.parse({ headline: 'Titre', summary: 'Accroche' })

describe('purgeOldData', () => {
  it('keeps only the active profile when no creation refers to the others', () => {
    const db = openDatabase(':memory:')
    createProfile(db, profile('Ancien'))
    createProfile(db, profile('Actuel'))

    purgeOldData(db, { keepCreations: 20 })

    expect(
      db
        .select()
        .from(profiles)
        .all()
        .map((p) => p.data.fullName),
    ).toEqual(['Actuel'])
    expect(getActiveProfile(db)?.profile.fullName).toBe('Actuel')
    db.close()
  })

  it('keeps the most recent creations with their job postings, and deletes the older ones', () => {
    const db = openDatabase(':memory:')
    const { id } = createProfile(db, profile('Actuel'))
    for (let i = 1; i <= 5; i++) saveTailoredCv(db, id, saveJobPosting(db, jobPosting(`Poste ${i}`)), cv)

    purgeOldData(db, { keepCreations: 2 })

    expect(db.select().from(tailoredCvs).all()).toHaveLength(2)
    expect(
      db
        .select()
        .from(jobPostings)
        .all()
        .map((o) => o.data.jobTitle),
    ).toEqual(['Poste 4', 'Poste 5'])
    db.close()
  })

  it('keeps an older profile as long as a kept creation was made from it', () => {
    const db = openDatabase(':memory:')
    const previous = createProfile(db, profile('Ancien'))
    saveTailoredCv(db, previous.id, saveJobPosting(db, jobPosting('Poste 1')), cv)
    createProfile(db, profile('Actuel'))

    purgeOldData(db, { keepCreations: 20 })

    expect(
      db
        .select()
        .from(profiles)
        .all()
        .map((p) => p.data.fullName),
    ).toEqual(['Ancien', 'Actuel'])
    db.close()
  })
})
