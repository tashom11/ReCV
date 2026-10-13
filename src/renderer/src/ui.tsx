import type { ReactNode } from 'react'
import { formaterDuree, useSecondesEcoulees } from './progression'

export function Spinner({ taille = 16 }: { taille?: number }) {
  return (
    <svg className="animate-spin" width={taille} height={taille} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Bloc « ça travaille » pour les tâches longues : pastille animée, étape en cours, temps écoulé et barre
 * de progression (déterminée si `courant`/`total` sont connus, sinon indéterminée).
 */
export function Chargement({
  titre,
  etape,
  courant,
  total,
  note,
}: {
  titre: string
  etape?: string
  courant?: number
  total?: number
  note?: string
}) {
  const secondes = useSecondesEcoulees(true)
  const determine = courant !== undefined && total !== undefined && total > 0
  return (
    <div
      role="status"
      aria-live="polite"
      className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-900"
    >
      <div className="flex items-center gap-3">
        <Spinner taille={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold">{titre}</p>
          {etape && (
            <p className="text-xs text-indigo-800">
              {etape}
              {determine ? ` (${courant}/${total})` : ''}
            </p>
          )}
        </div>
        <span className="font-mono text-xs tabular-nums text-indigo-700">{formaterDuree(secondes)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-indigo-200">
        {determine ? (
          <div
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(((courant ?? 0) / (total ?? 1)) * 100))}%` }}
          />
        ) : (
          <div className="barre-indeterminee h-full w-1/4 rounded bg-indigo-600" />
        )}
      </div>
      {note && <p className="text-xs text-indigo-700">{note}</p>}
    </div>
  )
}

const BASE_CHAMP =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export function Champ({
  etiquette,
  valeur,
  onChange,
  multiligne = false,
  lignes = 3,
  type = 'text',
  placeholder,
}: {
  etiquette: string
  valeur: string
  onChange: (valeur: string) => void
  multiligne?: boolean
  lignes?: number
  type?: 'text' | 'password' | 'url'
  placeholder?: string
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: le champ est imbriqué dans le label (conditionnel)
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{etiquette}</span>
      {multiligne ? (
        <textarea
          className={BASE_CHAMP}
          rows={lignes}
          value={valeur}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={BASE_CHAMP}
          type={type}
          value={valeur}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  )
}

export function Selection({
  etiquette,
  valeur,
  onChange,
  options,
}: {
  etiquette: string
  valeur: string
  onChange: (valeur: string) => void
  options: { valeur: string; libelle: string }[]
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{etiquette}</span>
      <select className={BASE_CHAMP} value={valeur} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Bouton({
  children,
  onClick,
  variante = 'principal',
  desactive = false,
  enCours = false,
}: {
  children: ReactNode
  onClick: () => void
  variante?: 'principal' | 'secondaire' | 'danger'
  desactive?: boolean
  /** Opération en cours déclenchée par ce bouton : pastille animée, clic désactivé. */
  enCours?: boolean
}) {
  const styles = {
    principal: 'bg-indigo-600 text-white hover:bg-indigo-500',
    secondaire: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variante]
  return (
    <button
      type="button"
      disabled={desactive || enCours}
      aria-busy={enCours}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
    >
      {enCours && <Spinner />}
      {children}
    </button>
  )
}

export function Alerte({
  type,
  children,
}: {
  type: 'erreur' | 'info' | 'avertissement' | 'succes'
  children: ReactNode
}) {
  const styles = {
    erreur: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    avertissement: 'border-amber-200 bg-amber-50 text-amber-900',
    succes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[type]
  return (
    <div role={type === 'erreur' ? 'alert' : 'status'} className={`rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}

export function Carte({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {titre && <h2 className="text-sm font-semibold text-slate-900">{titre}</h2>}
      {children}
    </section>
  )
}

export function Titre({ children, sousTitre }: { children: ReactNode; sousTitre?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold text-slate-900">{children}</h1>
      {sousTitre && <p className="text-sm text-slate-600">{sousTitre}</p>}
    </header>
  )
}

export function messageErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur)
}
