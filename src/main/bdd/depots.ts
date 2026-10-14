import type { JobPosting, Profile, TailoredCv } from '@core/schemas'
import { desc, eq, sql } from 'drizzle-orm'
import type { Bdd } from './connexion'
import { cvGeneres, offres, profils } from './schema'

/** Un seul profil actif : le plus récemment enregistré. */
export function obtenirProfilActif(bdd: Bdd): { id: number; profile: Profile } | null {
  const ligne = bdd.select().from(profils).orderBy(desc(profils.id)).limit(1).get()
  return ligne ? { id: ligne.id, profile: ligne.donnees } : null
}

/** Nouveau profil actif : les profils précédents (et les CV générés à partir d'eux) restent intacts. */
export function creerProfil(bdd: Bdd, profil: Profile): { id: number; profile: Profile } {
  const [cree] = bdd.insert(profils).values({ donnees: profil }).returning({ id: profils.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement du profil')
  return { id: cree.id, profile: profil }
}

/** Efface toutes les données personnelles (ordre imposé par les clés étrangères). */
export function effacerDonnees(bdd: Bdd): void {
  bdd.delete(cvGeneres).run()
  bdd.delete(offres).run()
  bdd.delete(profils).run()
  // The write-ahead log still holds the deleted rows: rebuild the file, then empty the log.
  bdd.run(sql`VACUUM`)
  bdd.run(sql`PRAGMA wal_checkpoint(TRUNCATE)`)
}

/**
 * Data minimisation: keeps the active profile and the `keepCreations` most recent tailored CVs (with their job
 * postings and the profiles they were made from). Everything older is deleted (and overwritten: secure_delete).
 */
export function purgeOldData(bdd: Bdd, { keepCreations }: { keepCreations: number }): void {
  bdd.transaction((tx) => {
    tx.run(
      sql`DELETE FROM cv_generes WHERE id NOT IN (SELECT id FROM cv_generes ORDER BY id DESC LIMIT ${keepCreations})`,
    )
    tx.run(sql`DELETE FROM offres WHERE id NOT IN (SELECT offre_id FROM cv_generes)`)
    tx.run(
      sql`DELETE FROM profils WHERE id <> (SELECT MAX(id) FROM profils) AND id NOT IN (SELECT profil_id FROM cv_generes)`,
    )
  })
}

/** Met à jour le profil actif s'il existe, sinon le crée. */
export function enregistrerProfil(bdd: Bdd, profil: Profile): { id: number; profile: Profile } {
  const actif = obtenirProfilActif(bdd)
  const misAJour = new Date().toISOString()
  if (actif) {
    bdd.update(profils).set({ donnees: profil, misAJour }).where(eq(profils.id, actif.id)).run()
    return { id: actif.id, profile: profil }
  }
  const [cree] = bdd.insert(profils).values({ donnees: profil, misAJour }).returning({ id: profils.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement du profil')
  return { id: cree.id, profile: profil }
}

export function enregistrerOffre(bdd: Bdd, offre: JobPosting, url?: string): number {
  const [cree] = bdd.insert(offres).values({ donnees: offre, url }).returning({ id: offres.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement de l’offre')
  return cree.id
}

export function enregistrerCv(bdd: Bdd, profilId: number, offreId: number, cv: TailoredCv): number {
  const [cree] = bdd.insert(cvGeneres).values({ profilId, offreId, donnees: cv }).returning({ id: cvGeneres.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement du CV')
  return cree.id
}
