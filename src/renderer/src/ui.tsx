import type { ReactNode } from 'react'

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

export function Bouton({
  children,
  onClick,
  variante = 'principal',
  desactive = false,
}: {
  children: ReactNode
  onClick: () => void
  variante?: 'principal' | 'secondaire' | 'danger'
  desactive?: boolean
}) {
  const styles = {
    principal: 'bg-indigo-600 text-white hover:bg-indigo-500',
    secondaire: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variante]
  return (
    <button
      type="button"
      disabled={desactive}
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
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
