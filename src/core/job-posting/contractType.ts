const CONTRACTS: { pattern: RegExp; name: string }[] = [
  { pattern: /\bCDI\b|contrat à durée indéterminée/i, name: 'CDI' },
  { pattern: /\bCDD\b|contrat à durée déterminée/i, name: 'CDD' },
  { pattern: /\bint[ée]rim\b|\bmission d[’']int[ée]rim\b/i, name: 'Intérim' },
  { pattern: /\balternance\b|contrat d[’']apprentissage|contrat de professionnalisation/i, name: 'Alternance' },
  { pattern: /\bstage\b/i, name: 'Stage' },
]

const WORKING_TIME: { pattern: RegExp; name: string }[] = [
  { pattern: /\btemps\s+plein\b|\btemps\s+complet\b/i, name: 'temps plein' },
  { pattern: /\btemps\s+partiel\b|\bmi-temps\b/i, name: 'temps partiel' },
]

/**
 * Contract type and working time quoted in the job posting text (« CDI · temps plein »).
 * Found by patterns, without the model: nothing is inferred, only what is written is kept.
 */
export function detectContractType(text: string): string | undefined {
  const contractType = CONTRACTS.find((c) => c.pattern.test(text))?.name
  const workingTime = WORKING_TIME.find((t) => t.pattern.test(text))?.name
  const parts = [contractType, workingTime].filter((p): p is string => p !== undefined)
  return parts.length > 0 ? parts.join(' · ') : undefined
}
