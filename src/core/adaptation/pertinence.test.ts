import { describe, expect, it } from 'vitest'
import { MoteurMock } from '../llm/moteurMock'
import type { JobPosting, Profile } from '../schemas'
import { adapterCv } from './pipeline'

// Cas réel : CV de développeur web (avec un passé de carrossier) face à une offre de carrossier peintre.
const profil: Profile = {
  fullName: 'Julien Moreau',
  headline: 'Développeur web / Carrossier peintre',
  summary: 'Expérience de 4 ans en développement web front-end avec HTML, CSS et JavaScript.',
  links: [],
  experiences: [
    {
      position: 'Développeur web front',
      company: 'Webagence',
      dateRange: '2022',
      achievements: ['Intégrer des interfaces utilisateur en HTML, CSS et JavaScript', 'Corriger des bugs'],
    },
    {
      position: 'Carrossier peintre',
      company: 'Carrosserie Dupont',
      dateRange: '2016 - 2020',
      achievements: [
        'Remise en état de carrosseries : débosselage, ponçage, préparation des surfaces',
        'Application de peintures et vernis avec respect des délais',
      ],
    },
  ],
  skills: ['WordPress / CMS', 'HTML / CSS', 'Rigueur', 'Sens du détail'],
  education: [
    { degree: 'BAC +2', school: 'École du Code', dateRange: '2022' },
    { degree: 'BAC PRO', school: 'Lycée Jean Moulin, Douai', dateRange: '2015' },
  ],
  languages: [{ name: 'Français' }],
}

const offre: JobPosting = {
  jobTitle: 'Carrossier peintre H/F',
  rawText: 'Nous recherchons un carrossier peintre rigoureux : ponçage, application de peinture et vernis.',
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
    expect(cv.experiences.map((e) => e.company)).toEqual(['Carrosserie Dupont'])
    expect(cv.experiences[0]?.sourceIndex).toBe(1)
    expect(cv.skills.slice(0, 2)).toEqual(['Rigueur', 'Sens du détail'])
    expect(cv.skills).not.toContain('WordPress / CMS')
    expect(cv.education.map((f) => f.degree)).toEqual(['BAC PRO'])
    expect(cv.excluded.experiences.map((e) => e.company)).toEqual(['Webagence'])
    expect(cv.excluded.experiences[0]?.bullets).toEqual(profil.experiences[0]?.achievements)
    expect(cv.excluded.skills).toEqual(['WordPress / CMS', 'HTML / CSS'])
    expect(cv.excluded.education.map((f) => f.degree)).toEqual(['BAC +2'])
    expect(cv.headline).toBe('Carrossier peintre')
    expect(cv.summary).toBe('Carrossier peintre rigoureux, attentif aux délais.')
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
    expect(cv.headline).toBe('Carrossier peintre')
    // Rejetée : repli sur une phrase de qualités attestées (jamais l'ancienne accroche du profil).
    expect(cv.summary).toMatch(/^Je fais preuve de /)
    expect(cv.summary).not.toMatch(/HTML|WordPress/)
  })

  it('garde une compétence citée mot pour mot dans l’offre, même jugée sans rapport', async () => {
    const offreAvecCss: JobPosting = { ...offre, rawText: `${offre.rawText} Notions de WordPress appréciées.` }
    const cv = await adapterCv(moteur({ accroche: 'Carrossier peintre.' }), profil, offreAvecCss)
    expect(cv.skills).toContain('WordPress / CMS')
    expect(cv.excluded.skills).toEqual(['HTML / CSS'])
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
    const cv = await adapterCv(m, profil, { jobTitle: 'Astronaute', rawText: 'Voyager dans l’espace.' })
    expect(cv.experiences).toHaveLength(2)
    expect(cv.excluded.experiences).toHaveLength(0)
  })
})
