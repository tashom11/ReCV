import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { Offre, Profil } from '../schemas'
import { harmoniserExperiences } from './pertinence'
import { adapterCv, borneAccroche } from './pipeline'
import { nettoyerPoint } from './reecriture'

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
        competencesUtiles: [3],
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

describe('nettoyerPoint / borneAccroche (sorties négligées d’un petit modèle)', () => {
  it('retire la ponctuation parasite et abandonne les puces sans mot', () => {
    expect(nettoyerPoint(',Collaboration avec les équipes design')).toBe('Collaboration avec les équipes design')
    expect(nettoyerPoint('"Optimisation des performances",')).toBe('Optimisation des performances')
    expect(nettoyerPoint('],')).toBe('')
    expect(nettoyerPoint('  ')).toBe('')
  })

  it('coupe une accroche trop longue à la dernière phrase complète', () => {
    const phrase = 'Développeur web attentif au SEO et à l’accessibilité des interfaces. '
    const longue = phrase.repeat(10)
    const bornee = borneAccroche(longue)
    expect(bornee.length).toBeLessThanOrEqual(450)
    expect(bornee.endsWith('.')).toBe(true)
    expect(borneAccroche('Courte accroche.')).toBe('Courte accroche.')
    expect(borneAccroche('x'.repeat(600))).toBe('')
  })
})

describe('adapterCv : signalement des étapes', () => {
  it('signale chaque étape, avec la progression expérience par expérience', async () => {
    const profil: Profil = {
      liensProfessionnels: [],
      experiences: [
        { poste: 'A', entreprise: 'X', realisations: ['Réalisation une'] },
        { poste: 'B', entreprise: 'Y', realisations: ['Réalisation deux'] },
      ],
      competences: [],
      formations: [],
      langues: [],
    }
    const m = new MoteurMock({
      motsCles: { titreCible: 'Dev', motsCles: [] },
      pertinence: {},
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const etapes: { etape: string; courant?: number; total?: number }[] = []
    await adapterCv(
      m,
      profil,
      { titrePoste: 'Dev', texteBrut: 'Offre' },
      { reformuler: true, surEtape: (e) => etapes.push(e) },
    )
    expect(etapes.map((e) => e.etape)).toEqual([
      'Analyse de l’offre',
      'Choix des éléments du profil à mettre en avant',
      'Reformulation des expériences',
      'Reformulation des expériences',
      'Rédaction de l’accroche',
    ])
    expect(etapes.filter((e) => e.courant !== undefined).map((e) => `${e.courant}/${e.total}`)).toEqual(['1/2', '2/2'])
  })
})

describe('adapterCv : compétences composées', () => {
  const profil: Profil = {
    liensProfessionnels: [],
    experiences: [
      {
        poste: 'Carrossier peintre',
        entreprise: 'Dupont',
        realisations: ['Gestion du diagnostic des dégâts', 'Ponçage'],
      },
    ],
    competences: ['Gestion & créa. de landing pages', 'HTML / CSS', 'Rigueur'],
    formations: [],
    langues: [],
  }
  const offre: Offre = {
    titrePoste: 'Carrossier peintre',
    texteBrut: 'Gestion des véhicules confiés, ponçage, peinture. Rigueur exigée.',
  }

  it('ne valide pas « Gestion & créa. de landing pages » sur le seul mot « gestion »', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Carrossier peintre', motsCles: ['ponçage'] },
      pertinence: {
        experiences: [{ indice: 0, pertinence: 2 }],
        competencesUtiles: [2],
      },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, offre)
    expect(cv.competences).toEqual(['Rigueur'])
    expect(cv.ecartes.competences).toEqual(['Gestion & créa. de landing pages', 'HTML / CSS'])
  })
})
