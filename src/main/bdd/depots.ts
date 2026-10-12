import type { CvAdapte, Offre, Profil } from '@core/schemas'
import { desc, eq } from 'drizzle-orm'
import type { Bdd } from './connexion'
import { cvGeneres, offres, profils } from './schema'

/** Un seul profil actif : le plus récemment enregistré. */
export function obtenirProfilActif(bdd: Bdd): { id: number; profil: Profil } | null {
  const ligne = bdd.select().from(profils).orderBy(desc(profils.id)).limit(1).get()
  return ligne ? { id: ligne.id, profil: ligne.donnees } : null
}

/** Met à jour le profil actif s'il existe, sinon le crée. */
export function enregistrerProfil(bdd: Bdd, profil: Profil): { id: number; profil: Profil } {
  const actif = obtenirProfilActif(bdd)
  const misAJour = new Date().toISOString()
  if (actif) {
    bdd.update(profils).set({ donnees: profil, misAJour }).where(eq(profils.id, actif.id)).run()
    return { id: actif.id, profil }
  }
  const [cree] = bdd.insert(profils).values({ donnees: profil, misAJour }).returning({ id: profils.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement du profil')
  return { id: cree.id, profil }
}

export function enregistrerOffre(bdd: Bdd, offre: Offre, url?: string): number {
  const [cree] = bdd.insert(offres).values({ donnees: offre, url }).returning({ id: offres.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement de l’offre')
  return cree.id
}

export function enregistrerCv(bdd: Bdd, profilId: number, offreId: number, cv: CvAdapte): number {
  const [cree] = bdd.insert(cvGeneres).values({ profilId, offreId, donnees: cv }).returning({ id: cvGeneres.id }).all()
  if (!cree) throw new Error('Échec de l’enregistrement du CV')
  return cree.id
}
