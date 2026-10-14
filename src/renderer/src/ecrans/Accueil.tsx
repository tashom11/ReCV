import { Bouton, Icone, IllustrationCv, type NomIcone } from '../ui'

/** Premier écran, tant qu'aucun CV n'est enregistré : la promesse en une phrase et un seul bouton. */
export function EcranAccueil({
  enLigne,
  onCommencer,
}: {
  /** Un service en ligne est choisi dans les réglages : on ne promet pas que rien n'est envoyé. */
  enLigne: boolean
  onCommencer: () => void
}) {
  const garanties: { icone: NomIcone; texte: string }[] = [
    {
      icone: 'cadenas',
      texte: enLigne
        ? 'Votre CV est enregistré sur votre ordinateur. Il est lu par le service en ligne choisi dans les Réglages.'
        : 'Votre CV reste sur votre ordinateur. Rien n’est envoyé.',
    },
    { icone: 'crayon', texte: 'Vous pouvez tout modifier avant de télécharger.' },
    { icone: 'telecharger', texte: 'Vous repartez avec un PDF ou un fichier Word.' },
  ]
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        <p className="inline-flex rounded-full border border-accent bg-accent-pale px-4 py-1.5 font-bold text-encre">
          {enLigne ? 'Gratuit · sans compte' : 'Gratuit · sans compte · sur votre ordinateur'}
        </p>
        <h1 className="max-w-xl font-titre text-titre-accueil font-bold">
          Un CV adapté à chaque annonce, en quelques minutes.
        </h1>
        <p className="max-w-xl text-[1.25rem] leading-relaxed text-encre-douce">
          Importez votre CV, indiquez l’annonce qui vous intéresse : Re:CV met en avant ce qui compte pour ce poste.
          Vous relisez et validez chaque changement.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <Bouton taille="grand" iconeFin="fleche-droite" onClick={onCommencer}>
            Commencer
          </Bouton>
          <span className="text-corps text-encre-douce">Environ 5 minutes la première fois</span>
        </div>
        <ul className="space-y-3 pt-2">
          {garanties.map((g) => (
            <li key={g.icone} className="flex items-center gap-3.5 text-intro text-encre">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-pale text-marque">
                <Icone nom={g.icone} taille={18} />
              </span>
              {g.texte}
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden pl-24 lg:block">
        <IllustrationCv avecFond coche />
      </div>
    </div>
  )
}
