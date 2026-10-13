import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { assainirProfil } from '../llm/assainissement'
import { cvAdapteSchema, type Profil, profilExtractionSchema, profilSchema } from '../schemas'
import { genererHtmlCv } from './CvHtml'
import { genererDocxCv } from './docx'
import { construireModele } from './modele'
import { IDS_MODELES, MODELES_CV, trouverModele } from './modeles'

// PNG 1×1 transparent.
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const profil: Profil = profilSchema.parse({
  nom: 'Julien Moreau',
  email: 'julien@exemple.fr',
  photo: PHOTO,
})
const cv = cvAdapteSchema.parse({
  titre: 'Chargé de recrutement',
  accroche: 'Je fais preuve d’autonomie.',
  competencesCles: ['LinkedIn Recruiter'],
  competences: ['Rigueur', 'HTML / CSS'],
  experiences: [{ poste: 'Développeur', entreprise: 'Webagence', periode: '2022', points: ['Intégration HTML'] }],
  formations: [{ diplome: 'BAC +2', etablissement: 'École du Code' }],
})

describe('catalogue de modèles', () => {
  it('propose au moins trois modèles, identifiés et décrits', () => {
    expect(MODELES_CV.length).toBeGreaterThanOrEqual(3)
    expect(MODELES_CV.map((m) => m.id)).toEqual([...IDS_MODELES])
    for (const m of MODELES_CV) {
      expect(m.nom).not.toBe('')
      expect(m.description).not.toBe('')
    }
  })

  it('retombe sur le modèle classique pour un identifiant inconnu', () => {
    expect(trouverModele('inconnu').id).toBe('classique')
    expect(trouverModele(undefined).id).toBe('classique')
  })
})

describe.each(IDS_MODELES)('modèle %s', (id) => {
  const modele = construireModele(profil, cv)
  const html = genererHtmlCv(modele, id)

  it('reste compatible ATS : une colonne, texte réel, aucun tableau ni SVG', () => {
    expect(html).not.toMatch(/<table|<svg|<canvas|<script/i)
    expect(html).toContain('Compétences clés : LinkedIn Recruiter')
    expect(html).toContain('<h2>Compétences</h2>')
    expect(html).toContain(`data-modele="${id}"`)
  })

  it('affiche la photo quand le profil en a une, sinon rien', () => {
    expect(html).toContain('<img class="photo"')
    const sans = genererHtmlCv(construireModele({ ...profil, photo: undefined }, cv), id)
    expect(sans).not.toContain('<img')
  })

  it('produit un DOCX relisible, avec la photo comme image et sans tableau', async () => {
    const buffer = await genererDocxCv(modele, id)
    const { value } = await mammoth.extractRawText({ buffer })
    expect(value).toContain('Julien Moreau')
    expect(value).toContain('COMPÉTENCES')
    const rendu = (await mammoth.convertToHtml({ buffer })).value
    expect(rendu).toContain('<img')
    expect(rendu).not.toContain('<table')
  })
})

describe('photo du profil', () => {
  it('n’est jamais demandée au modèle de langage (absente du schéma d’extraction)', () => {
    expect(Object.keys(profilExtractionSchema.shape)).not.toContain('photo')
    expect(Object.keys(profilSchema.shape)).toContain('photo')
  })

  it('n’accepte que des images PNG, JPEG ou WebP', () => {
    expect(profilSchema.safeParse({ photo: PHOTO }).success).toBe(true)
    expect(profilSchema.safeParse({ photo: 'data:text/html;base64,PGgxPg==' }).success).toBe(false)
    expect(profilSchema.safeParse({ photo: 'https://exemple.fr/moi.jpg' }).success).toBe(false)
  })

  it('refuse une image démesurée', () => {
    const enorme = `data:image/jpeg;base64,${'A'.repeat(310_000)}`
    expect(profilSchema.safeParse({ photo: enorme }).success).toBe(false)
  })

  it('l’assainissement d’un profil extrait ne fabrique pas de photo', () => {
    const extrait = profilExtractionSchema.parse({ nom: 'Julien' })
    expect(assainirProfil(extrait as Profil, 'Julien').photo).toBeUndefined()
  })
})
