import type { ReactNode } from 'react'
import { formaterDuree, useSecondesEcoulees } from '../progression'
import { Icone, type NomIcone, Spinner } from './icones'

export function Carte({ titre, sousTitre, children }: { titre?: string; sousTitre?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-carte border border-trait bg-surface p-6 shadow-carte">
      {titre && (
        <header>
          <h2 className="font-titre text-titre-section font-bold text-encre">{titre}</h2>
          {sousTitre && <p className="text-petit text-aide">{sousTitre}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Titre({
  children,
  sousTitre,
  surtitre,
}: {
  children: ReactNode
  sousTitre?: string
  /** Mention courte au-dessus du titre (« Annonce lue »), précédée d'une coche. */
  surtitre?: string
}) {
  return (
    <header className="space-y-2">
      {surtitre && (
        <p className="flex items-center gap-2 font-bold text-marque">
          <Icone nom="coche-cercle" />
          {surtitre}
        </p>
      )}
      <h1 className="font-titre text-titre-ecran font-bold text-encre">{children}</h1>
      {sousTitre && <p className="text-intro text-encre-douce">{sousTitre}</p>}
    </header>
  )
}

/**
 * Bloc « ça travaille » pour les attentes courtes à l'intérieur d'un écran : étape en cours, temps écoulé et
 * barre de progression (déterminée si `courant`/`total` sont connus, sinon indéterminée).
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
    <div role="status" aria-live="polite" className="space-y-3 rounded-carte border border-trait bg-surface p-5">
      <div className="flex items-center gap-3 text-encre">
        <span className="text-marque">
          <Spinner taille={22} />
        </span>
        <div className="flex-1">
          <p className="font-bold">{titre}</p>
          {etape && (
            <p className="text-petit text-aide">
              {etape}
              {determine ? ` (${courant}/${total})` : ''}
            </p>
          )}
        </div>
        <span className="text-petit tabular-nums text-aide" aria-hidden="true">
          {formaterDuree(secondes)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-creux">
        {determine ? (
          <div
            className="h-full rounded-full bg-marque transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round(((courant ?? 0) / (total ?? 1)) * 100))}%` }}
          />
        ) : (
          <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
        )}
      </div>
      {note && <p className="text-petit text-aide">{note}</p>}
    </div>
  )
}

/** Étiquette arrondie : toujours un mot (et une coche pour « présente »), jamais la couleur seule. */
export function Pastille({
  children,
  variante = 'demandee',
}: {
  children: ReactNode
  variante?: 'demandee' | 'presente' | 'recommande' | 'sur-sombre'
}) {
  const styles = {
    demandee: 'border border-accent bg-accent-pale px-4 py-1.5 text-corps text-encre',
    presente: 'border border-marque/40 bg-marque-pale px-4 py-1.5 text-corps text-encre',
    recommande: 'bg-marque px-2.5 py-0.5 text-petit font-bold text-white',
    'sur-sombre': 'bg-white/12 px-3 py-1 text-petit text-white',
  }[variante]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${styles}`}>
      {variante === 'presente' && <Icone nom="coche" taille={16} className="text-marque" />}
      {children}
    </span>
  )
}

/** Section d'un formulaire long, fermée par défaut : `<details>` natif (clavier et lecteurs d'écran gratuits). */
export function SectionRepliable({
  titre,
  compte,
  resume,
  ouverte = false,
  children,
}: {
  titre: string
  /** Nombre ou mention entre parenthèses après le titre (« (3) », « (facultative) »). */
  compte?: number | string
  /** Résumé d'une ligne sous le titre. */
  resume?: string
  ouverte?: boolean
  children: ReactNode
}) {
  return (
    <details open={ouverte} className="group rounded-carte border border-trait bg-surface shadow-carte">
      <summary className="flex min-h-16 items-center gap-4 rounded-carte px-5 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-titre text-intro font-bold text-encre">
            {titre}
            {compte !== undefined && <span className="font-sans font-normal text-encre-douce"> ({compte})</span>}
          </span>
          {resume && <span className="block truncate text-petit text-aide">{resume}</span>}
        </span>
        <Icone nom="chevron-bas" className="transition-transform duration-(--duree) group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-5 pt-1 pb-5">{children}</div>
    </details>
  )
}

/** Choix entre deux modes de saisie : onglets segmentés, flèches gauche/droite pour passer de l'un à l'autre. */
export function OngletsSegmentes<T extends string>({
  onglets,
  valeur,
  onChange,
  idPanneau,
  etiquette,
  desactive = false,
}: {
  onglets: { id: T; libelle: string; icone?: NomIcone }[]
  valeur: T
  onChange: (id: T) => void
  /** Identifiant du panneau commandé (`role="tabpanel"`). */
  idPanneau: string
  etiquette: string
  desactive?: boolean
}) {
  const deplacer = (pas: number) => {
    const indice = onglets.findIndex((o) => o.id === valeur)
    const suivant = onglets[(indice + pas + onglets.length) % onglets.length]
    if (!suivant) return
    onChange(suivant.id)
    document.getElementById(`${idPanneau}-onglet-${suivant.id}`)?.focus()
  }
  return (
    <div role="tablist" aria-label={etiquette} className="inline-flex gap-1 rounded-carte bg-creux p-1">
      {onglets.map((o) => {
        const actif = o.id === valeur
        return (
          <button
            key={o.id}
            id={`${idPanneau}-onglet-${o.id}`}
            type="button"
            role="tab"
            aria-selected={actif}
            aria-controls={idPanneau}
            tabIndex={actif ? 0 : -1}
            disabled={desactive}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') deplacer(1)
              if (e.key === 'ArrowLeft') deplacer(-1)
            }}
            className={`inline-flex min-h-12 items-center gap-2.5 rounded-bouton px-5 text-intro font-bold transition duration-(--duree-rapide) ${
              actif ? 'bg-surface text-encre shadow-carte' : 'text-encre-douce hover:text-encre'
            }`}
          >
            {o.icone && <Icone nom={o.icone} />}
            {o.libelle}
          </button>
        )
      })}
    </div>
  )
}

/** Écran sans contenu : dit ce qui apparaîtra ici et comment y arriver. */
export function EtatVide({ titre, texte, action }: { titre: string; texte: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panneau border-2 border-dashed border-trait bg-surface px-6 py-12 text-center">
      <div className="mb-2 w-[70px] space-y-2 rounded-champ border-2 border-trait bg-papier p-2.5" aria-hidden="true">
        <div className="h-1.5 w-3/5 rounded-full bg-trait" />
        <div className="h-1 rounded-full bg-trait" />
        <div className="h-1 w-4/5 rounded-full bg-trait" />
        <div className="h-1 w-3/5 rounded-full bg-trait" />
        <div className="h-6" />
      </div>
      <h2 className="font-titre text-titre-section font-bold text-encre">{titre}</h2>
      <p className="max-w-md text-corps text-encre-douce">{texte}</p>
      {action && <div className="pt-3">{action}</div>}
    </div>
  )
}

/** Barre collée en bas de l'écran : l'action de l'étape reste toujours visible. */
export function BarreActions({
  gauche,
  children,
  ton = 'sombre',
  largeur = 'max-w-6xl',
}: {
  gauche?: ReactNode
  children: ReactNode
  ton?: 'sombre' | 'clair'
  /** Classe de largeur maximale, alignée sur le contenu de l'écran. */
  largeur?: string
}) {
  return (
    <div
      className={`sticky bottom-0 z-10 shadow-barre ${
        ton === 'sombre' ? 'sur-sombre bg-encre text-white' : 'border-t border-trait bg-surface text-encre-douce'
      }`}
    >
      <div className={`mx-auto flex min-h-20 flex-wrap items-center justify-between gap-4 px-6 py-3 ${largeur}`}>
        <div className="text-corps">{gauche}</div>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </div>
  )
}

/** Vignette d'un modèle de CV : bouton à bascule, avec une coche et le mot « choisi » pour l'état sélectionné. */
export function VignetteModele({
  nom,
  choisi,
  onChoisir,
  children,
}: {
  nom: string
  choisi: boolean
  onChoisir: () => void
  /** Aperçu réduit du modèle. */
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={choisi}
      onClick={onChoisir}
      className={`w-[104px] shrink-0 space-y-1.5 rounded-bouton bg-surface p-2 text-center transition duration-(--duree-rapide) ${
        choisi ? 'border-2 border-marque shadow-carte' : 'border border-trait p-[9px] hover:border-trait-fort'
      }`}
    >
      {children}
      <span className={`flex items-center justify-center gap-1 text-petit ${choisi ? 'font-bold' : ''}`}>
        {choisi && <Icone nom="coche" taille={14} epaisseur={3} />}
        {nom}
        {choisi && <span className="sr-only"> (choisi)</span>}
      </span>
    </button>
  )
}
