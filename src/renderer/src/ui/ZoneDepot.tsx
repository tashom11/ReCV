import { useState } from 'react'
import { Bouton } from './Bouton'
import { Icone } from './icones'

/**
 * Grande zone de dépôt du CV. Le glisser-déposer est un raccourci : le bouton reste le chemin clavier
 * (il ouvre le sélecteur de fichier du système).
 */
export function ZoneDepot({
  onFichier,
  onChoisir,
  occupe = false,
}: {
  onFichier: (fichier: File) => void
  onChoisir: () => void
  occupe?: boolean
}) {
  const [survol, setSurvol] = useState(false)
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: le dépôt à la souris double le bouton, seul chemin clavier
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!occupe) setSurvol(true)
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSurvol(false)
        const fichier = e.dataTransfer.files[0]
        if (fichier && !occupe) onFichier(fichier)
      }}
      className={`flex flex-col items-center gap-4 rounded-panneau px-6 py-11 text-center transition duration-(--duree-rapide) ${
        survol ? 'border-2 border-marque bg-marque-pale' : 'border-2 border-dashed border-trait-fort bg-surface'
      }`}
    >
      <span
        className="flex size-[88px] items-center justify-center rounded-full border border-accent bg-accent-pale text-encre"
        aria-hidden="true"
      >
        <Icone nom="deposer" taille={36} epaisseur={2.2} />
      </span>
      <p className="pt-2 font-titre text-[1.75rem] leading-tight font-bold text-encre">
        {survol ? 'Lâchez le fichier ici' : 'Glissez votre CV ici'}
      </p>
      <p className="text-corps text-encre-douce">ou</p>
      <Bouton taille="grand" icone="dossier" onClick={onChoisir} enCours={occupe}>
        Choisir mon CV sur l’ordinateur
      </Bouton>
      <p className="pt-1 text-corps text-encre-douce">Fichier PDF ou Word (.docx)</p>
    </div>
  )
}
