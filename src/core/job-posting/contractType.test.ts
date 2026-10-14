import { describe, expect, it } from 'vitest'
import { detectContractType } from './contractType'

describe('detectContractType', () => {
  it('takes the contract and working time written in the job posting', () => {
    expect(detectContractType('Poste en CDI, à temps plein, basé à Lyon.')).toBe('CDI · temps plein')
    expect(detectContractType('Contrat à durée déterminée de 6 mois, temps partiel (24 h).')).toBe(
      'CDD · temps partiel',
    )
    expect(detectContractType('Mission d’intérim de 3 semaines')).toBe('Intérim')
    expect(detectContractType('Temps complet')).toBe('temps plein')
  })

  it('infers nothing when the job posting says nothing', () => {
    expect(detectContractType('Nous recherchons une personne organisée et souriante.')).toBeUndefined()
    // « stagiaire » or « CDIsation » are not contract types.
    expect(detectContractType('Vous encadrez les stagiaires du service.')).toBeUndefined()
  })
})
