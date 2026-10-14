import type { ReactNode } from 'react'
import { Icon, type IconName, Spinner } from './icons'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-filled' | 'accent' | 'outline' | 'on-dark'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-marque text-white shadow-[0_2px_0_var(--color-marque-survol)] hover:bg-marque-survol',
  secondary: 'border border-trait-fort bg-surface text-encre hover:bg-papier',
  danger: 'border border-erreur bg-surface text-erreur hover:bg-erreur-fond',
  'danger-filled': 'bg-erreur text-white hover:brightness-90',
  // On the dark action bar: the highlight of the screen.
  accent: 'bg-accent text-encre hover:brightness-95',
  outline: 'border-2 border-marque bg-surface text-marque hover:bg-marque-pale',
  'on-dark': 'border border-white/50 bg-transparent text-white hover:bg-white/10',
}

const SIZES = {
  small: 'min-h-11 px-4 text-libelle',
  normal: 'min-h-12 px-5 text-corps',
  // Main action of the screen.
  large: 'min-h-14 px-7 text-intro',
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'normal',
  disabled = false,
  busy = false,
  icon,
  endIcon,
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  variant?: ButtonVariant
  size?: keyof typeof SIZES
  disabled?: boolean
  /** Operation in progress started by this button: animated badge, click disabled. */
  busy?: boolean
  icon?: IconName
  /** Icon placed after the label (« continue » arrow). */
  endIcon?: IconName
  /** Accessible name when the visible label needs its context (« Retirer » → « Retirer l’anglais »). */
  ariaLabel?: string
}) {
  // Disabled: dashed border and dimmed text, not only opacity.
  const state =
    disabled && !busy
      ? 'cursor-not-allowed border border-dashed border-trait-fort bg-creux text-aide shadow-none'
      : `${VARIANTS[variant]}${busy ? ' cursor-progress opacity-85' : ''}`
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2.5 rounded-bouton font-bold transition duration-(--duree-rapide) ${SIZES[size]} ${state}`}
    >
      {busy ? <Spinner size={18} /> : icon && <Icon name={icon} />}
      {children}
      {endIcon && !busy && <Icon name={endIcon} />}
    </button>
  )
}

/** Discreet action shaped like an underlined link (« Revenir à mon CV », « Détails »). */
export function LinkButton({ children, onClick, icon }: { children: ReactNode; onClick: () => void; icon?: IconName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-champ font-bold text-marque hover:text-marque-survol"
    >
      {icon && <Icon name={icon} size={18} />}
      <span className="underline underline-offset-4">{children}</span>
    </button>
  )
}
