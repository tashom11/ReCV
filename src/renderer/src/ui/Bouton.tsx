import type { ReactNode } from 'react'
import { Icone, type NomIcone, Spinner } from './icones'

type Variante = 'principal' | 'secondaire' | 'danger' | 'danger-plein' | 'accent' | 'contour' | 'sur-sombre'

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-marque text-white shadow-[0_2px_0_var(--color-marque-survol)] hover:bg-marque-survol',
  secondaire: 'border border-trait-fort bg-surface text-encre hover:bg-papier',
  danger: 'border border-erreur bg-surface text-erreur hover:bg-erreur-fond',
  'danger-plein': 'bg-erreur text-white hover:brightness-90',
  // Sur la barre d'actions sombre : le temps fort de l'écran.
  accent: 'bg-accent text-encre hover:brightness-95',
  contour: 'border-2 border-marque bg-surface text-marque hover:bg-marque-pale',
  'sur-sombre': 'border border-white/50 bg-transparent text-white hover:bg-white/10',
}

const TAILLES = {
  petit: 'min-h-11 px-4 text-libelle',
  normal: 'min-h-12 px-5 text-corps',
  // Action principale de l'écran.
  grand: 'min-h-14 px-7 text-intro',
}

export function Bouton({
  children,
  onClick,
  variante = 'principal',
  taille = 'normal',
  desactive = false,
  enCours = false,
  icone,
  iconeFin,
}: {
  children: ReactNode
  onClick: () => void
  variante?: Variante
  taille?: keyof typeof TAILLES
  desactive?: boolean
  /** Opération en cours déclenchée par ce bouton : pastille animée, clic désactivé. */
  enCours?: boolean
  icone?: NomIcone
  /** Icône placée après le libellé (flèche « continuer »). */
  iconeFin?: NomIcone
}) {
  // Désactivé : bordure pointillée et texte atténué, pas seulement l'opacité.
  const etat =
    desactive && !enCours
      ? 'cursor-not-allowed border border-dashed border-trait-fort bg-creux text-aide shadow-none'
      : `${VARIANTES[variante]}${enCours ? ' cursor-progress opacity-85' : ''}`
  return (
    <button
      type="button"
      disabled={desactive || enCours}
      aria-busy={enCours}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2.5 rounded-bouton font-bold transition duration-(--duree-rapide) ${TAILLES[taille]} ${etat}`}
    >
      {enCours ? <Spinner taille={18} /> : icone && <Icone nom={icone} />}
      {children}
      {iconeFin && !enCours && <Icone nom={iconeFin} />}
    </button>
  )
}

/** Action discrète en forme de lien souligné (« Revenir à mon CV », « Détails »). */
export function BoutonLien({
  children,
  onClick,
  icone,
}: {
  children: ReactNode
  onClick: () => void
  icone?: NomIcone
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-champ font-bold text-marque hover:text-marque-survol"
    >
      {icone && <Icone nom={icone} taille={18} />}
      <span className="underline underline-offset-4">{children}</span>
    </button>
  )
}
