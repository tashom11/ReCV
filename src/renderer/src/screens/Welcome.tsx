import { texts } from '../i18n'
import { Button, HeroIllustration, Icon, type IconName } from '../ui'

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
      text: online ? texts.welcome.promises.online : texts.welcome.promises.local,
    },
    { icon: 'pencil', text: texts.welcome.promises.editable },
    { icon: 'download', text: texts.welcome.promises.formats },
  ]
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 sm:px-10 lg:px-16 py-12 sm:py-16 lg:grid-cols-[1fr_420px]">
      <div className="space-y-8">
        <p className="inline-flex rounded-full border border-accent bg-accent-pale px-4 py-1.5 font-bold text-encre">
          {online ? texts.welcome.badge : texts.welcome.badgeLocal}
        </p>
        <h1 className="max-w-xl font-titre text-titre-accueil font-bold">{texts.welcome.title}</h1>
        <p className="max-w-xl text-[1.25rem] leading-relaxed text-encre-douce">{texts.welcome.intro}</p>
        <div className="flex flex-wrap items-center gap-5">
          <Button size="large" endIcon="arrow-right" onClick={onStart}>
            {texts.welcome.start}
          </Button>
          <span className="text-corps text-encre-douce">{texts.welcome.duration}</span>
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
      <div className="hidden lg:block">
        <HeroIllustration />
      </div>
    </div>
  )
}
