import type { NumeroEtape } from '../parcours'
import { Icone } from './icones'

const NOMS: Record<NumeroEtape, string> = { 1: 'Mon CV', 2: 'L’annonce', 3: 'Mon nouveau CV' }
const NUMEROS: NumeroEtape[] = [1, 2, 3]

/**
 * Les trois étapes du parcours, toujours visibles en haut. L'état de chaque étape est écrit en toutes lettres
 * (faite, en cours, à venir) ; une étape faite est cliquable pour y revenir.
 */
export function Etapes({
  courante,
  faites,
  onAller,
  etatCourante = 'en cours',
  verrouille = false,
  accessibles = [],
  etats = {},
}: {
  courante: NumeroEtape | null
  faites: readonly NumeroEtape[]
  onAller: (etape: NumeroEtape) => void
  /** Libellé d'état de l'étape courante (« en cours », « en préparation »). */
  etatCourante?: string
  /** Aucune étape n'est cliquable (création en cours). */
  verrouille?: boolean
  /** Étapes où l'on peut revenir sans qu'elles soient terminées (un CV créé mais pas encore téléchargé). */
  accessibles?: readonly NumeroEtape[]
  /** État écrit propre à une étape, à la place de « faite » ou « à venir ». */
  etats?: Partial<Record<NumeroEtape, string>>
}) {
  return (
    <nav aria-label="Étapes" className="min-w-0 flex-1">
      <ol className="flex items-center gap-3">
        {NUMEROS.map((numero) => {
          const estCourante = numero === courante
          const faite = faites.includes(numero) && !estCourante
          const accessible = !estCourante && accessibles.includes(numero)
          const etat = estCourante ? etatCourante : (etats[numero] ?? (faite ? 'faite' : 'à venir'))
          const cliquable = (faite || accessible) && !verrouille
          const contenu = (
            <>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  estCourante
                    ? 'bg-encre text-accent ring-4 ring-accent-pale'
                    : faite
                      ? 'bg-marque text-white'
                      : 'border-2 border-trait-fort bg-surface text-encre-douce'
                }`}
              >
                {faite ? <Icone nom="coche" taille={20} epaisseur={3} /> : numero}
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span className={`block truncate text-petit ${faite ? 'font-bold text-marque' : 'text-encre-douce'}`}>
                  Étape {numero} · {etat}
                </span>
                <span
                  className={`block truncate font-bold ${estCourante || faite || accessible ? 'text-encre' : 'text-encre-douce'} ${
                    cliquable ? 'underline underline-offset-4' : ''
                  }`}
                >
                  {NOMS[numero]}
                </span>
              </span>
            </>
          )
          return (
            <li key={numero} className="flex min-w-0 flex-1 items-center gap-3 last:flex-none">
              {cliquable ? (
                <button
                  type="button"
                  onClick={() => onAller(numero)}
                  className="flex min-h-11 min-w-0 items-center gap-3 rounded-bouton"
                >
                  {contenu}
                </button>
              ) : (
                <span aria-current={estCourante ? 'step' : undefined} className="flex min-w-0 items-center gap-3">
                  {contenu}
                </span>
              )}
              {numero < 3 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 min-w-4 flex-1 rounded-full ${faite ? 'bg-marque' : 'bg-trait'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
