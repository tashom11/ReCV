const CONTRATS: { motif: RegExp; nom: string }[] = [
  { motif: /\bCDI\b|contrat à durée indéterminée/i, nom: 'CDI' },
  { motif: /\bCDD\b|contrat à durée déterminée/i, nom: 'CDD' },
  { motif: /\bint[ée]rim\b|\bmission d[’']int[ée]rim\b/i, nom: 'Intérim' },
  { motif: /\balternance\b|contrat d[’']apprentissage|contrat de professionnalisation/i, nom: 'Alternance' },
  { motif: /\bstage\b/i, nom: 'Stage' },
]

const TEMPS: { motif: RegExp; nom: string }[] = [
  { motif: /\btemps\s+plein\b|\btemps\s+complet\b/i, nom: 'temps plein' },
  { motif: /\btemps\s+partiel\b|\bmi-temps\b/i, nom: 'temps partiel' },
]

/**
 * Type de contrat et temps de travail cités dans le texte de l'annonce (« CDI · temps plein »).
 * Repérage par motifs, sans modèle : rien n'est déduit, seul ce qui est écrit est repris.
 */
export function repererContrat(texte: string): string | undefined {
  const contrat = CONTRATS.find((c) => c.motif.test(texte))?.nom
  const temps = TEMPS.find((t) => t.motif.test(texte))?.nom
  const parties = [contrat, temps].filter((p): p is string => p !== undefined)
  return parties.length > 0 ? parties.join(' · ') : undefined
}
