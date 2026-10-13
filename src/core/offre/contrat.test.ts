import { describe, expect, it } from 'vitest'
import { repererContrat } from './contrat'

describe('repererContrat', () => {
  it('reprend le contrat et le temps de travail écrits dans l’annonce', () => {
    expect(repererContrat('Poste en CDI, à temps plein, basé à Arras.')).toBe('CDI · temps plein')
    expect(repererContrat('Contrat à durée déterminée de 6 mois, temps partiel (24 h).')).toBe('CDD · temps partiel')
    expect(repererContrat('Mission d’intérim de 3 semaines')).toBe('Intérim')
    expect(repererContrat('Temps complet')).toBe('temps plein')
  })

  it('ne déduit rien quand l’annonce ne dit rien', () => {
    expect(repererContrat('Nous recherchons une personne organisée et souriante.')).toBeUndefined()
    // « stagiaire » ou « CDIsation » ne sont pas des types de contrat.
    expect(repererContrat('Vous encadrez les stagiaires du service.')).toBeUndefined()
  })
})
