// Durées dites simplement : une estimation honnête plutôt qu'un chronomètre à la seconde.

/** Durée supposée d'une création tant qu'aucune n'a été mesurée sur cet ordinateur. */
export const ESTIMATION_DEFAUT_S = 120
/** Au-delà, l'écran de création prévient que c'est plus long que prévu. */
export const SEUIL_LONG_S = 300

const CLE_DUREE = 'recv.dureeCreation'

type Stockage = Pick<Storage, 'getItem' | 'setItem'>

/** Estimation d'une création : la durée de la précédente sur cet ordinateur, bornée, sinon la valeur par défaut. */
export function lireEstimation(stockage: Stockage): number {
  const brute = Number(stockage.getItem(CLE_DUREE))
  return Number.isFinite(brute) && brute > 0 ? Math.min(900, Math.max(20, brute)) : ESTIMATION_DEFAUT_S
}

export function enregistrerDuree(stockage: Stockage, secondes: number): void {
  if (secondes > 0) stockage.setItem(CLE_DUREE, String(Math.round(secondes)))
}

const minutes = (secondes: number) => Math.max(1, Math.round(secondes / 60))
const enMinutes = (n: number) => `${n} minute${n > 1 ? 's' : ''}`

/** « Environ 2 minutes » : durée annoncée avant de lancer. */
export function dureeAnnoncee(estimationS: number): string {
  return estimationS < 45 ? 'Moins d’une minute' : `Environ ${enMinutes(minutes(estimationS))}`
}

/** « Encore environ 1 minute » : ce qu'il reste, sans jamais afficher zéro ni un compte à rebours. */
export function restantCreation(ecouleS: number, estimationS: number): string {
  const reste = estimationS - ecouleS
  if (reste <= 0) return 'Presque terminé'
  if (reste < 45) return 'Encore moins d’une minute'
  return `Encore environ ${enMinutes(minutes(reste))}`
}

/** « Depuis 1 min 05 s ». */
export function depuis(secondes: number): string {
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return m === 0 ? `Depuis ${s} s` : `Depuis ${m} min ${String(s).padStart(2, '0')} s`
}

/** Part de la barre remplie (0 à 1) : elle avance avec le temps mais ne se dit jamais finie avant la fin. */
export function avancement(ecouleS: number, estimationS: number): number {
  if (estimationS <= 0) return 0
  return Math.min(0.95, ecouleS / estimationS)
}

/** « 2,6 Go », « 850 Mo » : tailles à la française. */
export function formaterTaille(octets: number): string {
  const go = octets / 1024 ** 3
  if (go >= 1) return `${go.toFixed(1).replace('.', ',')} Go`
  return `${Math.round(octets / 1024 ** 2)} Mo`
}

/** Débit moyen (octets par seconde) entre deux relevés ; `null` tant qu'il est trop tôt pour le dire. */
export function debit(
  debut: { octets: number; instantMs: number },
  maintenant: { octets: number; instantMs: number },
): number | null {
  const duree = (maintenant.instantMs - debut.instantMs) / 1000
  const recus = maintenant.octets - debut.octets
  return duree >= 3 && recus > 0 ? recus / duree : null
}

/** « environ 6 minutes restantes », ou `null` sans débit connu. */
export function restantTelechargement(
  recuOctets: number,
  totalOctets: number,
  debitOctetsS: number | null,
): string | null {
  if (!debitOctetsS || totalOctets <= recuOctets) return null
  const secondes = (totalOctets - recuOctets) / debitOctetsS
  if (secondes < 45) return 'moins d’une minute restante'
  const n = minutes(secondes)
  return `environ ${n} minute${n > 1 ? 's restantes' : ' restante'}`
}
