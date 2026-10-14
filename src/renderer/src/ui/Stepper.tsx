import type { StepNumber } from '../flow'
import { texts } from '../i18n'
import { Icon } from './icons'

const STEP_NUMBERS: StepNumber[] = [1, 2, 3]

/**
 * The three steps of the flow, always visible at the top. The state of each step is written in full (done, in progress,
 * to come); a done step is clickable to go back to it.
 */
export function Stepper({
  currentStep,
  done,
  onGoTo,
  currentStepState = texts.stepper.states.current,
  locked = false,
  reachable = [],
  stepStates = {},
}: {
  currentStep: StepNumber | null
  done: readonly StepNumber[]
  onGoTo: (step: StepNumber) => void
  /** State label of the current step (« en cours », « en préparation »). */
  currentStepState?: string
  /** No step is clickable (generation in progress). */
  locked?: boolean
  /** Steps one can go back to without them being finished (a CV created but not downloaded yet). */
  reachable?: readonly StepNumber[]
  /** State written for a given step, instead of « faite » or « à venir ». */
  stepStates?: Partial<Record<StepNumber, string>>
}) {
  return (
    <nav aria-label={texts.stepper.label} className="min-w-0 flex-1 max-sm:order-last max-sm:basis-full">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEP_NUMBERS.map((number) => {
          const isCurrent = number === currentStep
          const isDone = done.includes(number) && !isCurrent
          const accessible = !isCurrent && reachable.includes(number)
          const state = isCurrent
            ? currentStepState
            : (stepStates[number] ?? (isDone ? texts.stepper.states.done : texts.stepper.states.upcoming))
          const clickable = (isDone || accessible) && !locked
          const content = (
            <>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${
                  isCurrent
                    ? 'bg-encre text-accent ring-4 ring-accent-pale'
                    : isDone
                      ? 'bg-marque text-white'
                      : 'border-2 border-trait-fort bg-surface text-encre-douce'
                }`}
              >
                {isDone ? <Icon name="check" size={20} strokeWidth={3} /> : number}
              </span>
              <span className="min-w-0 text-left leading-tight">
                <span
                  className={`block text-petit max-sm:sr-only ${isDone ? 'font-bold text-marque' : 'text-encre-douce'}`}
                >
                  {texts.stepper.step(number, state)}
                </span>
                <span
                  className={`block font-bold ${isCurrent || isDone || accessible ? 'text-encre' : 'text-encre-douce'} ${
                    clickable ? 'underline underline-offset-4' : ''
                  }`}
                >
                  {texts.stepper.names[number]}
                </span>
              </span>
            </>
          )
          return (
            <li key={number} className="flex min-w-0 flex-1 items-center gap-3 last:flex-none">
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onGoTo(number)}
                  className="flex min-h-11 min-w-0 items-center gap-3 rounded-bouton"
                >
                  {content}
                </button>
              ) : (
                <span aria-current={isCurrent ? 'step' : undefined} className="flex min-w-0 items-center gap-3">
                  {content}
                </span>
              )}
              {number < 3 && (
                <span
                  aria-hidden="true"
                  className={`h-0.5 min-w-4 flex-1 rounded-full ${isDone ? 'bg-marque' : 'bg-trait'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
