import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { Offre, Profil } from '../schemas'
import { adapterCv } from './pipeline'

// Cas réel : CV de développeur web (avec un passé de carrossier) face à une offre de carrossier peintre.
const profil: Profil = {
  nom: 'Julien Moreau',
  titrePoste: 'Développeur web / Carrossier peintre',
  accroche: 'Expérience de 4 ans en développement web front-end avec HTML, CSS et JavaScript.',
  liensProfessionnels: [],
  experiences: [
    {
      poste: 'Développeur web front',
      entreprise: 'Webagence',
      periode: '2022',
      realisations: ['Intégrer des interfaces utilisateur en HTML, CSS et JavaScript', 'Corriger des bugs'],
    },
    {
      poste: 'Carrossier peintre',
      entreprise: 'Carrosserie Dupont',
      periode: '2016 - 2020',
      realisations: [
        'Remise en état de carrosseries : débosselage, ponçage, préparation des surfaces',
        'Application de peintures et vernis avec respect des délais',
      ],
    },
  ],
  competences: ['WordPress / CMS', 'HTML / CSS', 'Rigueur', 'Sens du détail'],
  formations: [
    { diplome: 'BAC +2', etablissement: 'École du Code', periode: '2022' },
    { diplome: 'BAC PRO', etablissement: 'Lycée Jean Moulin, Douai', periode: '2015' },
  ],
  langues: [{ nom: 'Français' }],
}

const offre: Offre = {
  titrePoste: 'Carrossier peintre H/F',
  texteBrut: 'Nous recherchons un carrossier peintre rigoureux : ponçage, application de peinture et vernis.',
}

function moteur(accroche: { accroche: string }, competences = [0, 0, 1, 1]) {
  return new MoteurMock({
    motsCles: { titreCible: 'Carrossier peintre', motsCles: ['carrosserie', 'peinture', 'ponçage'] },
    pertinence: {
      experiences: [
        { indice: 0, pertinence: 0 },
        { indice: 1, pertinence: 2 },
      ],
      formations: [
        { indice: 0, pertinence: 0 },
        { indice: 1, pertinence: 1 },
      ],
      competencesUtiles: competences.flatMap((pertinence, indice) => (pertinence > 0 ? [indice] : [])),
    },
    reecriture: { points: ['Ponçage et préparation des surfaces', 'Application de peinture et vernis'] },
    accroche,
  })
}

describe('adapterCv : écarte ce qui est sans rapport avec l’offre', () => {
  it('ne garde que le métier visé et liste le reste dans « ecartes »', async () => {
    const cv = await adapterCv(
      moteur({ accroche: 'Carrossier peintre rigoureux, attentif aux délais.' }),
      profil,
      offre,
    )
    expect(cv.experiences.map((e) => e.entreprise)).toEqual(['Carrosserie Dupont'])
    expect(cv.experiences[0]?.indice).toBe(1)
    expect(cv.competences.slice(0, 2)).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.competences).not.toContain('WordPress / CMS')
    expect(cv.formations.map((f) => f.diplome)).toEqual(['BAC PRO'])
    expect(cv.ecartes.experiences.map((e) => e.entreprise)).toEqual(['Webagence'])
    expect(cv.ecartes.experiences[0]?.points).toEqual(profil.experiences[0]?.realisations)
    expect(cv.ecartes.competences).toEqual(['WordPress / CMS', 'HTML / CSS'])
    expect(cv.ecartes.formations.map((f) => f.diplome)).toEqual(['BAC +2'])
    expect(cv.titre).toBe('Carrossier peintre')
    expect(cv.accroche).toBe('Carrossier peintre rigoureux, attentif aux délais.')
  })

  it('ne transmet rien du domaine écarté au modèle qui rédige l’accroche', async () => {
    const m = moteur({ accroche: 'Carrossier peintre.' })
    await adapterCv(m, profil, offre)
    const redaction = m.requetes.find((r) => r.nom === 'accroche')
    expect(redaction?.utilisateur).not.toMatch(/Webagence|HTML|WordPress|développement web|Développeur web/i)
    // Seuls les savoir-être et les réalisations qui recoupent l'offre sont transmis : ni postes, ni employeurs.
    expect(redaction?.utilisateur).not.toMatch(/Dupont|Carrossier peintre"/)
    expect(redaction?.utilisateur).toContain('Rigueur')
  })

  it('remplace une accroche qui réintroduit le domaine écarté (jamais celle du profil d’origine) ; le titre vient du profil', async () => {
    const cv = await adapterCv(moteur({ accroche: 'Carrossier peintre et expert HTML / CSS.' }), profil, offre)
    expect(cv.titre).toBe('Carrossier peintre')
    // Rejetée : repli sur une phrase de qualités attestées (jamais l'ancienne accroche du profil).
    expect(cv.accroche).toMatch(/^Je fais preuve de /)
    expect(cv.accroche).not.toMatch(/HTML|WordPress/)
  })

  it('garde une compétence citée mot pour mot dans l’offre, même jugée sans rapport', async () => {
    const offreAvecCss: Offre = { ...offre, texteBrut: `${offre.texteBrut} Notions de WordPress appréciées.` }
    const cv = await adapterCv(moteur({ accroche: 'Carrossier peintre.' }), profil, offreAvecCss)
    expect(cv.competences).toContain('WordPress / CMS')
    expect(cv.ecartes.competences).toEqual(['HTML / CSS'])
  })

  it('ne vide jamais une section : tout est conservé si tout est jugé sans rapport', async () => {
    const m = new MoteurMock({
      motsCles: { titreCible: 'Astronaute', motsCles: [] },
      pertinence: {
        experiences: [
          { indice: 0, pertinence: 0 },
          { indice: 1, pertinence: 0 },
        ],
      },
      reecriture: { points: [] },
      accroche: { accroche: '' },
    })
    const cv = await adapterCv(m, profil, { titrePoste: 'Astronaute', texteBrut: 'Voyager dans l’espace.' })
    expect(cv.experiences).toHaveLength(2)
    expect(cv.ecartes.experiences).toHaveLength(0)
  })
})
