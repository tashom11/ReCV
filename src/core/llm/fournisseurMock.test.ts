import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cvAdapteSchema, offreSchema, profilSchema } from '../schemas'
import { FournisseurMock } from './fournisseurMock'

const texteCv = readFileSync(resolve(import.meta.dirname, '../../../fixtures/cv-exemple.txt'), 'utf-8')
const texteOffre = readFileSync(resolve(import.meta.dirname, '../../../fixtures/offre-exemple.txt'), 'utf-8')

describe('FournisseurMock', () => {
  it('extraireProfil renvoie un Profil valide', async () => {
    const fournisseur = new FournisseurMock()
    const profil = await fournisseur.extraireProfil(texteCv)
    expect(() => profilSchema.parse(profil)).not.toThrow()
    expect(profil.experiences.length).toBeGreaterThan(0)
  })

  it('extraireOffre renvoie une Offre valide dont le texte brut est fidèle à l’entrée', async () => {
    const fournisseur = new FournisseurMock()
    const offre = await fournisseur.extraireOffre(texteOffre)
    expect(() => offreSchema.parse(offre)).not.toThrow()
    expect(offre.texteBrut).toBe(texteOffre)
  })

  it('adapterCv renvoie un CvAdapte valide construit à partir du profil fourni', async () => {
    const fournisseur = new FournisseurMock()
    const profil = await fournisseur.extraireProfil(texteCv)
    const offre = await fournisseur.extraireOffre(texteOffre)
    const cvAdapte = await fournisseur.adapterCv(profil, offre)
    expect(() => cvAdapteSchema.parse(cvAdapte)).not.toThrow()
    expect(cvAdapte.experiences).toHaveLength(profil.experiences.length)
    expect(cvAdapte.competences).toEqual(profil.competences)
  })
})
