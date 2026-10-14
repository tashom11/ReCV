import { jobPostingSchema, profileSchema, tailoredCvSchema } from '@core/schemas'
import { describe, expect, it } from 'vitest'
import { ouvrirBdd } from './connexion'
import { creerProfil, enregistrerCv, enregistrerOffre, obtenirProfilActif, purgeOldData } from './depots'
import { cvGeneres, offres, profils } from './schema'

const profil = (nom: string) => profileSchema.parse({ fullName: nom })
const offre = (titrePoste: string) => jobPostingSchema.parse({ jobTitle: titrePoste, rawText: `Annonce ${titrePoste}` })
const cv = tailoredCvSchema.parse({ headline: 'Titre', summary: 'Accroche' })

describe('purgeOldData', () => {
  it('keeps only the active profile when no creation refers to the others', () => {
    const bdd = ouvrirBdd(':memory:')
    creerProfil(bdd, profil('Ancien'))
    creerProfil(bdd, profil('Actuel'))

    purgeOldData(bdd, { keepCreations: 20 })

    expect(
      bdd
        .select()
        .from(profils)
        .all()
        .map((p) => p.donnees.fullName),
    ).toEqual(['Actuel'])
    expect(obtenirProfilActif(bdd)?.profil.fullName).toBe('Actuel')
    bdd.fermer()
  })

  it('keeps the most recent creations with their job postings, and deletes the older ones', () => {
    const bdd = ouvrirBdd(':memory:')
    const { id } = creerProfil(bdd, profil('Actuel'))
    for (let i = 1; i <= 5; i++) enregistrerCv(bdd, id, enregistrerOffre(bdd, offre(`Poste ${i}`)), cv)

    purgeOldData(bdd, { keepCreations: 2 })

    expect(bdd.select().from(cvGeneres).all()).toHaveLength(2)
    expect(
      bdd
        .select()
        .from(offres)
        .all()
        .map((o) => o.donnees.jobTitle),
    ).toEqual(['Poste 4', 'Poste 5'])
    bdd.fermer()
  })

  it('keeps an older profile as long as a kept creation was made from it', () => {
    const bdd = ouvrirBdd(':memory:')
    const ancien = creerProfil(bdd, profil('Ancien'))
    enregistrerCv(bdd, ancien.id, enregistrerOffre(bdd, offre('Poste 1')), cv)
    creerProfil(bdd, profil('Actuel'))

    purgeOldData(bdd, { keepCreations: 20 })

    expect(
      bdd
        .select()
        .from(profils)
        .all()
        .map((p) => p.donnees.fullName),
    ).toEqual(['Ancien', 'Actuel'])
    bdd.fermer()
  })
})
