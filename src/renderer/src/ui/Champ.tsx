import { type ReactNode, useId } from 'react'
import { Icone } from './icones'

const BASE_CHAMP =
  'w-full rounded-champ border bg-surface px-3.5 text-corps text-encre placeholder:text-trait-fort transition duration-(--duree-rapide) hover:border-encre-douce'

const bordure = (erreur?: string) => (erreur ? 'border-2 border-erreur' : 'border-trait-fort')

function Pied({ idAide, aide, erreur }: { idAide: string; aide?: string; erreur?: string }) {
  if (erreur)
    return (
      <span id={idAide} className="flex items-start gap-1.5 text-petit font-bold text-erreur">
        <Icone nom="info" taille={16} className="mt-0.5" />
        {erreur}
      </span>
    )
  return aide ? (
    <span id={idAide} className="block text-petit text-aide">
      {aide}
    </span>
  ) : null
}

export function Champ({
  etiquette,
  valeur,
  onChange,
  multiligne = false,
  lignes = 3,
  type = 'text',
  placeholder,
  action,
  aide,
  erreur,
  grand = false,
}: {
  etiquette: string
  valeur: string
  onChange: (valeur: string) => void
  multiligne?: boolean
  lignes?: number
  type?: 'text' | 'password' | 'url'
  placeholder?: string
  /** Bouton affiché en bas à droite, à l'intérieur de la zone de texte (champs multilignes). */
  action?: ReactNode
  aide?: string
  erreur?: string
  /** Champ principal de l'écran (adresse de l'annonce) : plus haut, texte plus grand. */
  grand?: boolean
}) {
  const id = useId()
  const idAide = `${id}-aide`
  const decrit = aide || erreur ? idAide : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-libelle font-bold text-encre">
        {etiquette}
      </label>
      {multiligne ? (
        <div className="relative">
          <textarea
            id={id}
            className={`${BASE_CHAMP} ${bordure(erreur)} py-2.5${action ? ' pb-16' : ''}`}
            rows={lignes}
            value={valeur}
            placeholder={placeholder}
            aria-invalid={erreur ? true : undefined}
            aria-describedby={decrit}
            onChange={(e) => onChange(e.target.value)}
          />
          {action && <div className="absolute right-2.5 bottom-3.5">{action}</div>}
        </div>
      ) : (
        <input
          id={id}
          className={`${BASE_CHAMP} ${bordure(erreur)} ${grand ? 'min-h-14 text-intro' : 'min-h-12'}`}
          type={type}
          value={valeur}
          placeholder={placeholder}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <Pied idAide={idAide} aide={aide} erreur={erreur} />
    </div>
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
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-libelle font-bold text-encre">
        {etiquette}
      </label>
      <select
        id={id}
        className={`${BASE_CHAMP} min-h-12 border-trait-fort`}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Case à cocher de 22 px ; toute la ligne est cliquable (le label englobe la case). */
export function CaseACocher({
  etiquette,
  coche,
  onChange,
  aide,
  desactive = false,
}: {
  etiquette: ReactNode
  coche: boolean
  onChange: (coche: boolean) => void
  aide?: ReactNode
  desactive?: boolean
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-champ py-2.5">
      <input
        type="checkbox"
        className="mt-px size-[22px] shrink-0"
        checked={coche}
        disabled={desactive}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-corps text-encre">{etiquette}</span>
        {aide && <span className="block text-petit text-aide">{aide}</span>}
      </span>
    </label>
  )
}
