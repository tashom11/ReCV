import { describe, expect, it } from 'vitest'
import { downloadAnnouncement, windowTitle } from './accessibility'

describe('windowTitle', () => {
  it('names the step and its position in the three-step flow', () => {
    expect(windowTitle('cv')).toBe('Étape 1 sur 3 : mon CV — Re:CV')
    expect(windowTitle('annonce')).toBe('Étape 2 sur 3 : l’annonce — Re:CV')
    expect(windowTitle('resultat')).toBe('Étape 3 sur 3 : mon nouveau CV — Re:CV')
  })

  it('names the screens outside the flow', () => {
    expect(windowTitle('accueil')).toBe('Re:CV')
    expect(windowTitle('preparation')).toBe('Préparation — Re:CV')
    expect(windowTitle('creation')).toBe('Création de votre CV — Re:CV')
    expect(windowTitle('succes')).toBe('CV téléchargé — Re:CV')
    expect(windowTitle('reglages')).toBe('Réglages — Re:CV')
  })
})

describe('downloadAnnouncement', () => {
  it('only changes every 10 %, so a screen reader is not flooded', () => {
    expect(downloadAnnouncement(31, false)).toBe('Téléchargement : 30 %')
    expect(downloadAnnouncement(39, false)).toBe('Téléchargement : 30 %')
    expect(downloadAnnouncement(40, false)).toBe('Téléchargement : 40 %')
  })

  it('announces the verification instead of a percentage', () => {
    expect(downloadAnnouncement(100, true)).toBe('Vérification du fichier')
  })
})
