import { type ReactNode, useEffect, useRef } from 'react'
import { Icone, type NomIcone } from './icones'

type TypeAlerte = 'erreur' | 'info' | 'avertissement' | 'succes'

const STYLES: Record<TypeAlerte, { fond: string; texte: string; pave: string; icone: NomIcone }> = {
  erreur: { fond: 'border-erreur/35 bg-erreur-fond', texte: 'text-erreur', pave: 'bg-erreur', icone: 'croix-cercle' },
  info: { fond: 'border-info/30 bg-info-fond', texte: 'text-info', pave: 'bg-info', icone: 'info' },
  avertissement: { fond: 'border-alerte/35 bg-alerte-fond', texte: 'text-alerte', pave: 'bg-alerte', icone: 'alerte' },
  succes: { fond: 'border-succes/35 bg-succes-fond', texte: 'text-succes', pave: 'bg-succes', icone: 'coche' },
}

/**
 * Message d'état. Avec un `titre` : pavé d'icône, titre, explication et actions (« ce qui se passe, et quoi faire »).
 * Sans titre : bandeau compact. La couleur ne porte jamais seule l'information : chaque type a son icône.
 */
export function Alerte({
  type,
  titre,
  icone,
  actions,
  children,
}: {
  type: TypeAlerte
  titre?: string
  icone?: NomIcone
  /** Boutons proposés ; le premier est l'action conseillée. */
  actions?: ReactNode
  children?: ReactNode
}) {
  const style = STYLES[type]
  const refTitre = useRef<HTMLHeadingElement>(null)

  // Une erreur déplace le focus sur son titre : l'action proposée est alors le premier bouton atteint au clavier.
  useEffect(() => {
    if (type === 'erreur' && titre) refTitre.current?.focus()
  }, [type, titre])

  const role = type === 'erreur' ? 'alert' : 'status'

  if (!titre) {
    return (
      <div role={role} className={`flex items-start gap-3 rounded-carte border px-4 py-3 ${style.fond} ${style.texte}`}>
        <Icone nom={icone ?? style.icone} className="mt-0.5" />
        <div className="min-w-0 flex-1 text-corps">{children}</div>
      </div>
    )
  }

  return (
    <div role={role} className={`flex items-start gap-4 rounded-carte border p-5 ${style.fond}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-champ text-white ${style.pave}`}>
        <Icone nom={icone ?? style.icone} />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 ref={refTitre} tabIndex={-1} className={`font-titre text-intro font-bold outline-none ${style.texte}`}>
          {titre}
        </h3>
        {children && <div className="text-corps text-encre">{children}</div>}
        {actions && <div className="flex flex-wrap items-center gap-3 pt-2.5">{actions}</div>}
      </div>
    </div>
  )
}

/** Confirmation brève, annoncée aux lecteurs d'écran, à faire disparaître après quelques secondes. */
export function Confirmation({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-carte border border-succes/35 bg-succes-fond px-4 py-3 font-bold text-succes"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-champ bg-succes text-white">
        <Icone nom="coche" taille={18} />
      </span>
      {children}
    </div>
  )
}
