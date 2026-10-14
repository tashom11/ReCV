import { Button, CvIllustration, Icon, type IconName } from '../ui'

/** First screen, as long as no CV is saved: the promise in one sentence and a single button. */
export function WelcomeScreen({
  online,
  onStart,
}: {
  /** An online service is chosen in the settings: do not promise that nothing is sent. */
  online: boolean
  onStart: () => void
}) {
  const promises: { icon: IconName; text: string }[] = [
    {
      icon: 'lock',
      text: online
        ? 'Votre CV est enregistré sur votre ordinateur. Il est lu par le service en ligne choisi dans les Réglages.'
        : 'Votre CV reste sur votre ordinateur. Rien n’est envoyé.',
    },
    { icon: 'pencil', text: 'Vous pouvez tout modifier avant de télécharger.' },
    { icon: 'download', text: 'Vous repartez avec un PDF ou un fichier Word.' },
  ]
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        <p className="inline-flex rounded-full border border-accent bg-accent-pale px-4 py-1.5 font-bold text-encre">
          {online ? 'Gratuit · sans compte' : 'Gratuit · sans compte · sur votre ordinateur'}
        </p>
        <h1 className="max-w-xl font-titre text-titre-accueil font-bold">
          Un CV adapté à chaque annonce, en quelques minutes.
        </h1>
        <p className="max-w-xl text-[1.25rem] leading-relaxed text-encre-douce">
          Importez votre CV, indiquez l’annonce qui vous intéresse : Re:CV met en avant ce qui compte pour ce poste.
          Vous relisez et validez chaque changement.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          <Button size="large" endIcon="arrow-right" onClick={onStart}>
            Commencer
          </Button>
          <span className="text-corps text-encre-douce">Environ 5 minutes la première fois</span>
        </div>
        <ul className="space-y-3 pt-2">
          {promises.map((g) => (
            <li key={g.icon} className="flex items-center gap-3.5 text-intro text-encre">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marque-pale text-marque">
                <Icon name={g.icon} size={18} />
              </span>
              {g.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="hidden pl-24 lg:block">
        <CvIllustration withBackground check />
      </div>
    </div>
  )
}
