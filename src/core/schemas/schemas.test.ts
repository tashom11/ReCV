import { describe, expect, it } from 'vitest'
import { cvAdapteSchema, experienceSchema, formationSchema, langueSchema, offreSchema, profilSchema } from './index'

describe('experienceSchema', () => {
  it('accepte une expérience minimale valide', () => {
    expect(() => experienceSchema.parse({ poste: 'Développeur', entreprise: 'Acme' })).not.toThrow()
  })

  it('rejette une expérience sans poste', () => {
    expect(() => experienceSchema.parse({ entreprise: 'Acme' })).toThrow()
  })
})

describe('formationSchema', () => {
  it('accepte une formation minimale valide', () => {
    expect(() => formationSchema.parse({ diplome: 'Master', etablissement: 'Université X' })).not.toThrow()
  })

  it('rejette une formation sans établissement', () => {
    expect(() => formationSchema.parse({ diplome: 'Master' })).toThrow()
  })
})

describe('langueSchema', () => {
  it('accepte une langue minimale valide', () => {
    expect(() => langueSchema.parse({ nom: 'Français' })).not.toThrow()
  })

  it('rejette une langue sans nom', () => {
    expect(() => langueSchema.parse({ niveau: 'Courant' })).toThrow()
  })
})

describe('profilSchema', () => {
  it('accepte un profil vide et applique les valeurs par défaut', () => {
    const profil = profilSchema.parse({})
    expect(profil.experiences).toEqual([])
    expect(profil.competences).toEqual([])
    expect(profil.formations).toEqual([])
    expect(profil.langues).toEqual([])
  })

  it('rejette un profil avec une expérience invalide', () => {
    expect(() => profilSchema.parse({ experiences: [{ poste: 'Développeur' }] })).toThrow()
  })
})

describe('offreSchema', () => {
  it('accepte une offre minimale valide', () => {
    expect(() => offreSchema.parse({ titrePoste: 'Développeur', texteBrut: 'Texte de l’offre' })).not.toThrow()
  })

  it('rejette une offre sans texteBrut', () => {
    expect(() => offreSchema.parse({ titrePoste: 'Développeur' })).toThrow()
  })
})

describe('cvAdapteSchema', () => {
  it('accepte un CV adapté minimal valide', () => {
    expect(() => cvAdapteSchema.parse({ titre: 'Développeur', accroche: 'Accroche' })).not.toThrow()
  })

  it('rejette un CV adapté sans titre', () => {
    expect(() => cvAdapteSchema.parse({ accroche: 'Accroche' })).toThrow()
  })
})
