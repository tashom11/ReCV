import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { Offre, Profil } from '../schemas'
import { harmoniserExperiences } from './pertinence'
import { adapterCv } from './pipeline'

describe('harmoniserExperiences', () => {
  const postes = [{ poste: 'Développeur web front' }, { poste: 'Développeur Web Front' }, { poste: 'Carrossier' }]

  it('donne la même note aux expériences au même intitulé de poste', () => {
    expect(harmoniserExperiences([0, 1, 0], postes)).toEqual([1, 1, 0])
  })

  it('propage la note la plus haute entre expériences du même domaine', () => {
    const experiences = [{ poste: 'Intégrateur' }, { poste: 'Webmaster' }, { poste: 'Carrossier' }]
    expect(
      harmoniserExperiences([0, 2, 0], experiences, ['développement web', 'Développement web', 'carrosserie']),
    ).toEqual([2, 2, 0])
  })

  it('ne change rien si les expériences n’ont ni poste ni domaine en commun', () => {
    const experiences = [{ poste: 'A' }, { poste: 'B' }]
    expect(harmoniserExperiences([2, 0], experiences, ['x', 'y'])).toEqual([2, 0])
  })
})

describe('adapterCv : titre, durées et compétences attestées', () => {
  const profil: Profil = {
    titrePoste: 'Développeur web front',
    accroche: 'Accroche d’origine',
    liensProfessionnels: [],
    experiences: [
      {
        poste: 'Développeur web front',
        entreprise: 'Agence Pixel',
        periode: '2021 - 2022',
        realisations: ['Respect des standards SEO et de l’accessibilité (RGAA)'],
      },
      { poste: 'Carrossier peintre', entreprise: 'Dupont', periode: '2016 - 2020', realisations: ['Ponçage'] },
    ],
    competences: ['SEO', 'RGAA', 'PHP', 'Rigueur'],
    formations: [],
    langues: [],
  }
  const offre: Offre = {
    titrePoste: 'Community Manager',
    texteBrut: 'Animation des réseaux sociaux, gestion éditoriale, mise à jour du site internet.',
  }
  const moteur = (accroche: string) =>
    new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: ['Community Manager'], competencesRequises: [] },
      pertinence: {
        experiences: [
          { indice: 0, pertinence: 1 },
          { indice: 1, pertinence: 0 },
        ],
        competences: [
          { indice: 0, pertinence: 0 },
          { indice: 1, pertinence: 0 },
          { indice: 2, pertinence: 0 },
          { indice: 3, pertinence: 1 },
        ],
      },
      reecriture: { points: [] },
      accroche: { accroche },
    })

  it('ne laisse jamais le modèle donner au CV le titre du poste visé', async () => {
    const cv = await adapterCv(moteur('Community Manager expérimenté.'), profil, offre)
    expect(cv.titre).toBe('Développeur web front')
    expect(cv.accroche).toBe('')
  })

  it('rejette une durée déduite des dates (« 1 an ») et garde le titre issu du profil', async () => {
    const cv = await adapterCv(moteur('Développeur web avec 1 an d’expérience en SEO.'), profil, offre)
    expect(cv.accroche).toBe('')
    expect(cv.titre).toBe('Développeur web front')
  })

  it('accepte une accroche fidèle sans durée', async () => {
    const cv = await adapterCv(moteur('Développeur web front attentif au SEO et à l’accessibilité.'), profil, offre)
    expect(cv.accroche).toBe('Développeur web front attentif au SEO et à l’accessibilité.')
  })

  it('conserve une compétence attestée dans une expérience conservée, même jugée sans rapport', async () => {
    const cv = await adapterCv(moteur('Développeur web front.'), profil, offre)
    expect(cv.competences).toEqual(expect.arrayContaining(['SEO', 'RGAA', 'Rigueur']))
    expect(cv.ecartes.competences).toEqual(['PHP'])
  })

  it('titre de repli : intitulé de l’expérience conservée la plus pertinente quand le profil n’a pas de titre', async () => {
    const sansTitre: Profil = { ...profil, titrePoste: undefined }
    const cv = await adapterCv(moteur('Développeur web front.'), sansTitre, offre)
    expect(cv.titre).toBe('Développeur web front')
  })
})

describe('adapterCv : aucune expérience jugée pertinente', () => {
  const profil: Profil = {
    titrePoste: 'Développeur web / Carrossier peintre',
    liensProfessionnels: [],
    experiences: [
      { poste: 'Développeur web front', entreprise: 'Webagence', realisations: ['Intégration'] },
      { poste: 'Carrossier peintre', entreprise: 'Dupont', realisations: ['Ponçage'] },
    ],
    competences: [],
    formations: [],
    langues: [],
  }
  const offre: Offre = { titrePoste: 'Community Manager', texteBrut: 'Animation des réseaux sociaux.' }
  const notesNulles = {
    experiences: [
      { indice: 0, domaine: 'développement web', pertinence: 0 },
      { indice: 1, domaine: 'carrosserie automobile', pertinence: 0 },
    ],
  }

  it('met en avant le domaine le plus proche (choix relatif) au lieu de tout garder', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: [] },
      pertinence: notesNulles,
      domaineProche: { choix: 0 },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.experiences.map((e) => e.entreprise)).toEqual(['Webagence'])
    expect(cv.ecartes.experiences.map((e) => e.entreprise)).toEqual(['Dupont'])
    expect(cv.titre).toBe('Développeur web front')
  })

  it('garde tout si le choix est incohérent', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Community Manager', motsCles: [] },
      pertinence: notesNulles,
      domaineProche: { choix: 42 },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.experiences).toHaveLength(2)
  })
})
