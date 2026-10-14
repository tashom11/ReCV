import { describe, expect, it } from 'vitest'
import { detectContractType } from './contractType'

describe('repererContrat', () => {
  it('reprend le contrat et le temps de travail écrits dans l’annonce', () => {
    expect(detectContractType('Poste en CDI, à temps plein, basé à Arras.')).toBe('CDI · temps plein')
    expect(detectContractType('Contrat à durée déterminée de 6 mois, temps partiel (24 h).')).toBe(
      'CDD · temps partiel',
    )
    expect(detectContractType('Mission d’intérim de 3 semaines')).toBe('Intérim')
    expect(detectContractType('Temps complet')).toBe('temps plein')
  })

  it('ne déduit rien quand l’annonce ne dit rien', () => {
    expect(detectContractType('Nous recherchons une personne organisée et souriante.')).toBeUndefined()
    // « stagiaire » ou « CDIsation » ne sont pas des types de contrat.
    expect(detectContractType('Vous encadrez les stagiaires du service.')).toBeUndefined()
  })
})
