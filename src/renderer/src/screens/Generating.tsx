import { useEffect, useState } from 'react'
import { announcedDuration, elapsedLabel, LONG_THRESHOLD_S, progressRatio, remainingGeneration } from '../estimate'
import { currentGenerationStep, GENERATION_STEPS } from '../flow'
import { useElapsedSeconds, useTaskProgress } from '../progress'
import { Alert, Button, CvIllustration, Icon, Spinner } from '../ui'

/** Wait during the tailored CV generation: named steps, estimated time, cancellation possible. */
export function GeneratingScreen({
  jobTitle,
  postingRead,
  layingOut,
  estimateS,
  online,
  onCancel,
}: {
  jobTitle: string
  /** The job posting was already analysed at step ②: the first line is done from the start. */
  postingRead: boolean
  /** The content is ready, the preview is being prepared (last line). */
  layingOut: boolean
  estimateS: number
  /** An online service does the work: do not say that nothing leaves the computer. */
  online: boolean
  onCancel: () => void
}) {
  const progress = useTaskProgress('tailoring', true)
  const seconds = useElapsedSeconds(true)
  const [cancelling, setCancelling] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const currentStep = currentGenerationStep(progress?.key, postingRead, layingOut)
  const part = layingOut ? 1 : Math.max(progressRatio(seconds, estimateS), currentStep / GENERATION_STEPS.length)
  const isLong = seconds >= LONG_THRESHOLD_S && !waiting && !layingOut

  // Time runs on screen, but only step changes are announced to screen readers.
  const [posting, setPosting] = useState('')
  useEffect(() => setPosting(`${GENERATION_STEPS[currentStep]} : en cours`), [currentStep])

  const cancel = () => {
    setCancelling(true)
    onCancel()
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[360px_1fr]">
      <div className="hidden lg:block">
        <CvIllustration animated />
      </div>

      <div className="max-w-2xl space-y-6">
        <header className="space-y-3">
          <h1 className="font-titre text-titre-ecran font-bold">Nous préparons votre CV pour « {jobTitle} »</h1>
          <p className="text-intro text-encre-douce">
            {announcedDuration(estimateS)}. Vous pouvez réduire la fenêtre en attendant.
          </p>
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          {posting}
        </p>
        <ol className="space-y-1">
          {GENERATION_STEPS.map((step, i) => {
            const state = i < currentStep ? 'fait' : i === currentStep ? 'downloading' : 'a-venir'
            return (
              <li
                key={step}
                className={`flex min-h-[52px] items-center gap-4 rounded-bouton px-3 ${
                  state === 'downloading'
                    ? 'etape-commence border border-trait bg-surface font-bold shadow-carte'
                    : 'border border-transparent'
                }`}
              >
                {state === 'fait' ? (
                  <span className="etape-finie flex size-8 shrink-0 items-center justify-center rounded-full bg-marque text-white">
                    <Icon name="check" size={18} strokeWidth={3} />
                  </span>
                ) : state === 'downloading' ? (
                  <span className="flex size-8 shrink-0 items-center justify-center text-marque">
                    <Spinner size={24} />
                  </span>
                ) : (
                  <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-trait-fort" />
                )}
                <span className={`flex-1 text-intro ${state === 'a-venir' ? 'text-encre-douce' : 'text-encre'}`}>
                  {step}
                </span>
                <span
                  className={`text-libelle ${state === 'fait' ? 'font-bold text-marque' : state === 'downloading' ? 'text-encre' : 'text-encre-douce'}`}
                >
                  {state === 'fait' ? 'Fait' : state === 'downloading' ? 'En cours' : 'À venir'}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="space-y-2">
          <div
            role="progressbar"
            aria-label="Avancement de la création"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(part * 100)}
            className="h-2.5 overflow-hidden rounded-full bg-creux"
          >
            <div
              className="h-full rounded-full bg-marque transition-all duration-1000 ease-linear"
              style={{ width: `${Math.round(part * 100)}%` }}
            />
          </div>
          <p className="flex justify-between text-libelle text-encre-douce" aria-hidden="true">
            <span>{elapsedLabel(seconds)}</span>
            <span>{layingOut ? 'Presque terminé' : remainingGeneration(seconds, estimateS)}</span>
          </p>
        </div>

        {isLong ? (
          <Alert
            type="info"
            icon="timer"
            title="C’est plus long que prévu, mais ça avance"
            actions={
              <>
                <Button variant="secondary" size="small" onClick={() => setWaiting(true)}>
                  Continuer d’attendre
                </Button>
                <Button variant="secondary" size="small" onClick={cancel} busy={cancelling}>
                  Annuler
                </Button>
              </>
            }
          >
            {progress?.compute === 'cpu'
              ? 'Votre ordinateur calcule sans aide de la carte graphique. '
              : 'Votre ordinateur calcule encore. '}
            Pour aller plus vite la prochaine fois, choisissez « Rapide » dans les Réglages.
          </Alert>
        ) : (
          <p className="flex items-start gap-3 rounded-carte border border-trait bg-surface px-5 py-4 text-corps text-encre">
            <Icon name="lock" className="mt-0.5 text-marque" />
            {online
              ? 'Votre CV et l’annonce sont envoyés au service en ligne choisi dans les Réglages, le temps de la création.'
              : 'Votre ordinateur fait tout le travail lui-même : c’est parfois un peu long, mais rien ne sort de chez vous.'}
          </p>
        )}

        {!isLong && (
          <Button variant="secondary" onClick={cancel} busy={cancelling} disabled={layingOut}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  )
}
