import logo from '../assets/logo.png'
import { headerForView, type StepNumber, stepForView, type View } from '../flow'
import { texts } from '../i18n'
import { Icon, LinkButton, Stepper } from '../ui'

/** Top bar: logo, the three steps (on the flow screens), and access to the settings. */
export function AppHeader({
  view,
  done,
  hasUndownloadedCv,
  notifications,
  onGoToStep,
  onSettings,
  onBack,
}: {
  view: View
  done: StepNumber[]
  /** A CV was created but not downloaded yet: step ③ stays reachable. */
  hasUndownloadedCv: boolean
  /** Number in the red badge of the settings button (a downloaded update waits for a restart). */
  notifications: number
  onGoToStep: (step: StepNumber) => void
  onSettings: () => void
  /** Back from the settings to where the user was. */
  onBack: () => void
}) {
  const header = headerForView(view)
  return (
    <header className="sticky top-0 z-20 border-b border-trait bg-surface">
      <div className="mx-auto flex min-h-[72px] max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-2">
        <span className="flex shrink-0 items-center gap-3 font-titre text-2xl font-bold text-encre">
          <img src={logo} alt="" width={40} height={40} className="rounded-champ" />
          {texts.appName}
        </span>
        {header.steps ? (
          <Stepper
            currentStep={stepForView(view)}
            done={done}
            onGoTo={onGoToStep}
            currentStepState={view === 'generating' ? texts.stepper.states.preparing : texts.stepper.states.current}
            locked={view === 'generating'}
            reachable={hasUndownloadedCv ? [3] : []}
            stepStates={hasUndownloadedCv ? { 3: texts.stepper.states.toDownload } : {}}
          />
        ) : (
          <span className="flex-1" />
        )}
        {view === 'settings' && (
          <LinkButton icon="arrow-left" onClick={onBack}>
            {texts.header.back}
          </LinkButton>
        )}
        {header.settings && (
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex min-h-11 shrink-0 items-center gap-3 rounded-bouton px-2 text-intro text-encre hover:text-marque"
          >
            <span className="relative">
              <Icon name="settings" size={22} />
              {/* A downloaded version is shown wherever the settings can be reached. */}
              {notifications > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-transparent bg-erreur px-1 text-[0.75rem] leading-none font-bold text-white ring-2 ring-surface"
                >
                  {notifications}
                </span>
              )}
            </span>
            {texts.header.settings}
            {notifications > 0 && <span className="sr-only">{texts.header.notifications(notifications)}</span>}
          </button>
        )}
      </div>
    </header>
  )
}
