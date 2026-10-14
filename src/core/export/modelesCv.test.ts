import mammoth from 'mammoth'
import { describe, expect, it } from 'vitest'
import { assainirProfil } from '../llm/assainissement'
import { type Profile, profileExtractionSchema, profileSchema, tailoredCvSchema } from '../schemas'
import { genererHtmlCv } from './CvHtml'
import { genererDocxCv } from './docx'
import { construireModele } from './modele'
import { IDS_MODELES, MODELES_CV, trouverModele } from './modeles'

// PNG 1×1 transparent.
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const profil: Profile = profileSchema.parse({
  fullName: 'Julien Moreau',
  email: 'julien@exemple.fr',
  photo: PHOTO,
})
const cv = tailoredCvSchema.parse({
  headline: 'Chargé de recrutement',
  summary: 'Je fais preuve d’autonomie.',
  keySkills: ['LinkedIn Recruiter'],
  skills: ['Rigueur', 'HTML / CSS'],
  experiences: [{ position: 'Développeur', company: 'Webagence', dateRange: '2022', bullets: ['Intégration HTML'] }],
  education: [{ degree: 'BAC +2', school: 'École du Code' }],
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

  it('reste compatible ATS : texte réel, titres standards, aucun tableau ni SVG', () => {
    expect(html).not.toMatch(/<table|<svg|<canvas|<script/i)
    if (trouverModele(id).disposition === 'lateral') {
      // Colonne latérale : sous-titre et liste, le contenu principal restant avant la colonne dans le code.
      expect(html).toContain('<h3>Compétences clés</h3><ul><li>LinkedIn Recruiter</li>')
      expect(html.indexOf('<h2>Expérience professionnelle</h2>')).toBeLessThan(html.indexOf('<h2>Compétences</h2>'))
    } else {
      expect(html).toContain('Compétences clés : LinkedIn Recruiter')
    }
    expect(html).toContain('<h2>Compétences</h2>')
    expect(html).toContain(`data-modele="${id}"`)
  })

  it('n’espace jamais les lettres (l’extraction ATS lirait « p r o f i l »)', () => {
    expect(trouverModele(id).css).not.toMatch(/letter-spacing\s*:\s*[^;0]/)
  })

  it('n’affiche pas de nom d’entreprise parmi les coordonnées ni de diplôme parmi les expériences', () => {
    const sale = construireModele(
      { ...profil, links: ['Webagence', 'linkedin.com/in/julien'] },
      {
        ...cv,
        experiences: [...cv.experiences, { position: 'BAC +2', company: '', location: '', dateRange: '', bullets: [] }],
      },
    )
    const rendu = genererHtmlCv(sale, id)
    expect(rendu).toContain('linkedin.com/in/julien')
    expect(rendu).not.toContain('Webagence</span>')
    expect(rendu.match(/<h3>BAC \+2<\/h3>/g)).toHaveLength(1)
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
    expect(Object.keys(profileExtractionSchema.shape)).not.toContain('photo')
    expect(Object.keys(profileSchema.shape)).toContain('photo')
  })

  it('n’accepte que des images PNG, JPEG ou WebP', () => {
    expect(profileSchema.safeParse({ photo: PHOTO }).success).toBe(true)
    expect(profileSchema.safeParse({ photo: 'data:text/html;base64,PGgxPg==' }).success).toBe(false)
    expect(profileSchema.safeParse({ photo: 'https://exemple.fr/moi.jpg' }).success).toBe(false)
  })

  it('refuse une image démesurée', () => {
    const enorme = `data:image/jpeg;base64,${'A'.repeat(310_000)}`
    expect(profileSchema.safeParse({ photo: enorme }).success).toBe(false)
  })

  it('l’assainissement d’un profil extrait ne fabrique pas de photo', () => {
    const extrait = profileExtractionSchema.parse({ fullName: 'Julien' })
    expect(assainirProfil(extrait as Profile, 'Julien').photo).toBeUndefined()
  })
})
