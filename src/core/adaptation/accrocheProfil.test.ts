import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { Profil } from '../schemas'
import { genererAccrocheProfil, MESSAGE_AUCUNE_COMPETENCE, motsNonAttestes } from './accrocheProfil'

const profil: Profil = {
  titrePoste: 'Développeur web / Carrossier peintre',
  accroche: 'Expérience de 4 ans en développement web.',
  liensProfessionnels: [],
  experiences: [
    {
      poste: 'Développeur web front',
      entreprise: 'Webagence',
      realisations: ['Collaborer avec les équipes design et back-end', 'Respect des délais'],
    },
  ],
  competences: ['Rigueur', 'Autonomie', 'Organisation', 'HTML / CSS', 'WordPress / CMS'],
  formations: [],
  langues: [],
}

const moteur = (reponse: { competencesTransversales: string[]; accroche: string }) =>
  new MoteurMock({ accrocheProfil: reponse })

describe('genererAccrocheProfil', () => {
  it('retourne l’accroche du modèle quand elle ne cite que des compétences transversales', async () => {
    const accroche = 'Professionnel rigoureux et autonome, doté d’un bon sens de l’organisation.'
    const m = moteur({ competencesTransversales: ['Rigueur', 'Autonomie', 'Organisation'], accroche })
    expect(await genererAccrocheProfil(m, profil)).toBe(accroche)
  })

  it('ne transmet au modèle ni poste ni employeur', async () => {
    const m = moteur({ competencesTransversales: ['Rigueur'], accroche: 'Professionnel rigoureux.' })
    await genererAccrocheProfil(m, profil)
    expect(m.requetes[0]?.utilisateur).not.toMatch(/Webagence|Développeur web front/)
  })

  it('rejette une accroche qui cite un outil de métier, et se replie sur les compétences retenues', async () => {
    const m = moteur({
      competencesTransversales: ['Rigueur', 'Autonomie'],
      accroche: 'Professionnel rigoureux, expert HTML / CSS.',
    })
    expect(await genererAccrocheProfil(m, profil)).toBe('Professionnel alliant rigueur et autonomie.')
  })

  it('rejette une accroche contenant un chiffre ou un employeur', async () => {
    for (const accroche of ['Rigoureux depuis 4 ans.', 'Rigoureux, ancien de Webagence.']) {
      const m = moteur({ competencesTransversales: ['Rigueur'], accroche })
      expect(await genererAccrocheProfil(m, profil)).toBe('Professionnel alliant rigueur.')
    }
  })

  it('n’accepte que des compétences présentes mot pour mot dans le profil', async () => {
    const m = moteur({
      competencesTransversales: ['Rigueur', 'Leadership', 'Esprit visionnaire'],
      accroche: 'Leader visionnaire.',
    })
    // « Leadership » et « Esprit visionnaire » ne figurent pas dans le profil : seule « Rigueur » est retenue.
    expect(await genererAccrocheProfil(m, profil)).toBe('Professionnel alliant rigueur.')
  })

  it('reconnaît une compétence transversale attestée dans les réalisations', async () => {
    const m = moteur({
      competencesTransversales: ['respect des délais'],
      accroche: 'Professionnel capable d’assurer le respect des délais.',
    })
    expect(await genererAccrocheProfil(m, profil)).toBe('Professionnel capable d’assurer le respect des délais.')
  })

  it('signale clairement l’absence de compétence transversale', async () => {
    const m = moteur({ competencesTransversales: ['Leadership'], accroche: 'Leader inspirant et visionnaire.' })
    await expect(genererAccrocheProfil(m, profil)).rejects.toThrow(MESSAGE_AUCUNE_COMPETENCE)
  })
})

describe('motsNonAttestes', () => {
  const source = 'Rigueur, Autonomie, Organisation, Communication claire, Travail en équipe'

  it('accepte les variantes morphologiques de qualités du profil', () => {
    expect(
      motsNonAttestes('Professionnel rigoureux et autonome, doté d’un bon sens de l’organisation.', source),
    ).toEqual([])
  })

  it('signale les qualités absentes du profil', () => {
    expect(motsNonAttestes('Leader visionnaire et créatif.', source)).toEqual(['leader', 'visionnaire', 'creatif'])
  })
})
