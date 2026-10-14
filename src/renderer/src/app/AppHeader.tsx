import logo from '../assets/logo.png'
import { headerForView, type StepNumber, stepForView, type View } from '../flow'
import { Icon, LinkButton, Stepper } from '../ui'

/** Top bar: logo, the three steps (on the flow screens), and access to the settings. */
export function AppHeader({
  view,
  done,
  hasUndownloadedCv,
  updateReady,
  onGoToStep,
  onSettings,
  onBack,
}: {
  view: View
  done: StepNumber[]
  /** A CV was created but not downloaded yet: step ③ stays reachable. */
  hasUndownloadedCv: boolean
  /** A downloaded update waits for a restart. */
  updateReady: boolean
  onGoToStep: (step: StepNumber) => void
  onSettings: () => void
  /** Back from the settings to where the user was. */
  onBack: () => void
}) {
  const header = headerForView(view)
  return (
    <header className="sticky top-0 z-20 border-b border-trait bg-surface">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-8 px-6">
        <span className="flex shrink-0 items-center gap-3 font-titre text-2xl font-bold text-encre">
          <img src={logo} alt="" width={40} height={40} className="rounded-champ" />
          Re:CV
        </span>
        {header.steps ? (
          <Stepper
            currentStep={stepForView(view)}
            done={done}
            onGoTo={onGoToStep}
            currentStepState={view === 'generating' ? 'en préparation' : 'en cours'}
            locked={view === 'generating'}
            reachable={hasUndownloadedCv ? [3] : []}
            stepStates={hasUndownloadedCv ? { 3: 'à télécharger' } : {}}
          />
        ) : (
          <span className="flex-1" />
        )}
        {view === 'settings' && (
          <LinkButton icon="arrow-left" onClick={onBack}>
            Revenir où j’en étais
          </LinkButton>
        )}
        {/* A downloaded version is shown wherever the settings can be reached. */}
        {header.settings && updateReady && (
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-accent bg-accent-pale px-4 font-bold text-encre hover:brightness-95"
          >
            <Icon name="download" size={18} />
            Mise à jour prête
          </button>
        )}
        {header.settings && (
          <button
            type="button"
            onClick={onSettings}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-bouton px-2 text-intro text-encre hover:text-marque"
          >
            <Icon name="settings" size={22} />
            Réglages
          </button>
        )}
      </div>
    </header>
  )
}
