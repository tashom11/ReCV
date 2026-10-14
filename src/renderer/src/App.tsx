import type { GeneratedCv } from '@core/api'
import type { JobPosting, Profile } from '@core/schemas'
import { isLocalService } from '@core/serviceUrl'
import { composeCv, initialChoices } from '@core/tailoring/composition'
import { useCallback, useEffect, useRef, useState } from 'react'
import { focusScreenTitle, windowTitle } from './accessibility'
import logo from './assets/logo.png'
import { describeError, type ErrorDescription, isCancellation } from './errors'
import { readEstimate, saveDuration } from './estimate'
import {
  afterStart,
  doneSteps,
  engineReady,
  headerForView,
  initialView,
  type StepNumber,
  stepForView,
  titleWithoutGender,
  type View,
  viewForStep,
} from './flow'
import { GeneratingScreen } from './screens/Generating'
import { JobPostingScreen, type ReadJobPosting } from './screens/JobPosting'
import { MyCvScreen } from './screens/MyCv'
import { NewCvScreen } from './screens/NewCv'
import { SettingsScreen } from './screens/Settings'
import { SetupScreen } from './screens/Setup'
import { SuccessScreen } from './screens/Success'
import { useUpdateState } from './screens/Updates'
import { WelcomeScreen } from './screens/Welcome'
import { Alert, Button, EmptyState, Icon, LinkButton, Stepper } from './ui'

interface Result {
  /** Profile at the time of creation: the experience indices must match it. */
  profile: Profile
  jobPosting: JobPosting
  generated: GeneratedCv
}

const FILE_NAME_KEY = 'recv.nomFichierCv'

export default function App() {
  const [view, setView] = useState<View | null>(null)
  // View to go back to when leaving the settings or the setup.
  const returnView = useRef<View>('welcome')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fileName, setFileName] = useState<string | null>(() => localStorage.getItem(FILE_NAME_KEY))
  const [posting, setPosting] = useState<ReadJobPosting | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<ErrorDescription | null>(null)
  const [layingOut, setLayingOut] = useState(false)
  const [estimate, setEstimate] = useState(() => readEstimate(localStorage))
  const [engine, setEngine] = useState<{ ready: boolean; online: boolean }>({ ready: true, online: false })

  const update = useUpdateState()

  const checkEngine = useCallback(
    () =>
      Promise.all([window.api.getSettings(), window.api.getModelsState()]).then(
        ([p, m]) => {
          // "Online": the CV leaves this computer (online service, or Ollama on another machine).
          const online = p.provider === 'api' || (p.provider === 'ollama' && !isLocalService(p.ollamaUrl))
          const state = { ready: engineReady(p, m.models), online }
          setEngine(state)
          return state
        },
        () => ({ ready: true, online: false }),
      ),
    [],
  )

  useEffect(() => {
    void checkEngine()
    window.api.getProfile().then(
      (existing) => {
        if (existing) setProfile(existing.profile)
        setView(initialView(existing !== null))
      },
      () => setView('welcome'),
    )
  }, [checkEngine])

  // Each screen change is announced: window title, then focus on the title of the new screen
  // (the clicked button has disappeared, the focus would otherwise fall back to the page).
  const previousView = useRef<View | null>(null)
  useEffect(() => {
    if (view === null) return
    document.title = windowTitle(view)
    const isFirstScreen = previousView.current === null
    previousView.current = view
    // Effects run after the DOM is updated: the new title is already there. (No requestAnimationFrame: it is
    // paused while the window is minimised, which users are invited to do during long tasks.)
    if (!isFirstScreen) focusScreenTitle()
  }, [view])

  const goTo = useCallback((nextView: View) => {
    setView((currentView) => {
      if ((nextView === 'settings' || nextView === 'setup') && currentView && currentView !== nextView) {
        if (currentView !== 'settings' && currentView !== 'setup') returnView.current = currentView
      }
      return nextView
    })
    window.scrollTo({ top: 0 })
  }, [])

  const goToSetup = useCallback(() => goTo('setup'), [goTo])

  const onProfile = (next: Profile, file?: string) => {
    setProfile(next)
    if (file) {
      setFileName(file)
      localStorage.setItem(FILE_NAME_KEY, file)
    }
  }

  const create = async () => {
    if (!posting || !profile) return
    const { jobPosting } = posting
    const start = Date.now()
    setGenerationError(null)
    setLayingOut(false)
    goTo('generating')
    try {
      const generated = await window.api.tailorCv(jobPosting)
      saveDuration(localStorage, (Date.now() - start) / 1000)
      setEstimate(readEstimate(localStorage))
      // Last announced step: the preview is prepared before showing the result.
      setLayingOut(true)
      const { cvTemplate } = await window.api.getSettings()
      const bullets = generated.cv.experiences.map((e) => e.bullets)
      await window.api
        .templateHtml(composeCv(profile, generated.cv, initialChoices(generated.cv), bullets), cvTemplate)
        .catch(() => '')
      setResult({ profile, jobPosting, generated })
      setExportedPath(null)
      goTo('result')
    } catch (e) {
      // Cancelled: back to the job posting, without a message. Interrupted: the job posting is kept, it can be run
      // again.
      if (!isCancellation(e)) setGenerationError(describeError('generating', e))
      goTo('posting')
    }
  }

  const anotherPosting = () => {
    setPosting(null)
    setResult(null)
    setExportedPath(null)
    setGenerationError(null)
    goTo('posting')
  }

  const onDataErased = useCallback(() => {
    setProfile(null)
    setFileName(null)
    localStorage.removeItem(FILE_NAME_KEY)
    setPosting(null)
    setResult(null)
    setExportedPath(null)
    returnView.current = 'welcome'
    goTo('welcome')
  }, [goTo])

  const onSettingsChanged = useCallback(() => void checkEngine(), [checkEngine])

  const onReady = useCallback(() => {
    void checkEngine()
    goTo(returnView.current === 'welcome' ? 'cv' : returnView.current)
  }, [goTo, checkEngine])

  if (view === null) return <div className="min-h-screen bg-papier" />

  const header = headerForView(view)
  const done = doneSteps({
    profilePresent: profile !== null,
    postingConfirmed: result !== null || view === 'generating',
    exportedPath: exportedPath !== null,
  })
  const goToStep = (step: StepNumber) => goTo(viewForStep(step))
  // Nothing can be read nor created without an engine: say so where it is needed, with the action to fix it.
  const engineMissing = !engine.ready && (view === 'cv' || view === 'posting')

  return (
    <div className="flex min-h-screen flex-col bg-papier text-encre">
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
              onGoTo={goToStep}
              currentStepState={view === 'generating' ? 'en préparation' : 'en cours'}
              locked={view === 'generating'}
              reachable={result && !exportedPath ? [3] : []}
              stepStates={result && !exportedPath ? { 3: 'à télécharger' } : {}}
            />
          ) : (
            <span className="flex-1" />
          )}
          {view === 'settings' && (
            <LinkButton icon="arrow-left" onClick={() => goTo(returnView.current)}>
              Revenir où j’en étais
            </LinkButton>
          )}
          {/* A downloaded version is shown wherever the settings can be reached. */}
          {header.settings && update?.status === 'ready' && (
            <button
              type="button"
              onClick={() => goTo('settings')}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-accent bg-accent-pale px-4 font-bold text-encre hover:brightness-95"
            >
              <Icon name="download" size={18} />
              Mise à jour prête
            </button>
          )}
          {header.settings && (
            <button
              type="button"
              onClick={() => goTo('settings')}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-bouton px-2 text-intro text-encre hover:text-marque"
            >
              <Icon name="settings" size={22} />
              Réglages
            </button>
          )}
        </div>
      </header>

      <main className="ecrans flex flex-1 flex-col">
        {engineMissing && (
          <div className="mx-auto w-full max-w-4xl px-6 pt-8">
            <Alert
              type="warning"
              title="Re:CV n’est pas encore tout à fait prêt"
              actions={
                <Button size="small" onClick={goToSetup}>
                  Terminer la préparation
                </Button>
              }
            >
              Il manque un téléchargement unique. Ensuite, plus besoin d’internet.
            </Alert>
          </div>
        )}

        {view === 'welcome' && (
          <WelcomeScreen
            online={engine.online}
            onStart={() => {
              returnView.current = 'welcome'
              void checkEngine().then((state) => goTo(afterStart(state.ready)))
            }}
          />
        )}
        {view === 'setup' && (
          <SetupScreen
            onReady={onReady}
            onLater={() => goTo(returnView.current === 'welcome' ? 'cv' : returnView.current)}
            onSettings={() => goTo('settings')}
          />
        )}
        {view === 'cv' && (
          <MyCvScreen
            profile={profile}
            fileName={fileName}
            online={engine.online}
            onProfile={onProfile}
            onNext={() => goTo('posting')}
            onSetup={goToSetup}
          />
        )}
        {view === 'posting' &&
          (profile ? (
            <JobPostingScreen
              posting={posting}
              onJobPosting={(a) => {
                setPosting(a)
                setGenerationError(null)
              }}
              estimateS={estimate}
              generationError={generationError}
              onCreate={() => void create()}
              onBackToCv={() => goTo('cv')}
              onSetup={goToSetup}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-6 py-12">
              <EmptyState
                title="Commençons par votre CV"
                text="Pour lire une annonce et y adapter votre CV, il nous faut d’abord votre CV actuel."
                action={<Button onClick={() => goTo('cv')}>Importer mon CV</Button>}
              />
            </div>
          ))}
        {view === 'generating' && posting && (
          <GeneratingScreen
            jobTitle={titleWithoutGender(posting.jobPosting.jobTitle)}
            postingRead
            layingOut={layingOut}
            estimateS={estimate}
            online={engine.online}
            onCancel={() => void window.api.cancelTailoring()}
          />
        )}
        {/* Kept mounted as long as a CV exists: adjustments are not lost when going through another screen. */}
        {result && (
          <div className={view === 'result' ? 'flex flex-1 flex-col' : 'hidden'}>
            <NewCvScreen
              key={result.generated.id}
              profile={result.profile}
              tailored={result.generated.cv}
              onExported={(path) => {
                setExportedPath(path)
                goTo('success')
              }}
            />
          </div>
        )}
        {view === 'result' && !result && (
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <EmptyState
              title="Votre nouveau CV apparaîtra ici"
              text="Pour le créer, il nous faut votre CV actuel et l’annonce qui vous intéresse."
              action={
                <Button onClick={() => goTo(profile ? 'posting' : 'cv')}>
                  {profile ? 'Indiquer une annonce' : 'Commencer par mon CV'}
                </Button>
              }
            />
          </div>
        )}
        {view === 'success' && exportedPath && result && (
          <SuccessScreen
            path={exportedPath}
            jobTitle={titleWithoutGender(result.jobPosting.jobTitle)}
            onAnotherPosting={anotherPosting}
          />
        )}
        {view === 'settings' && <SettingsScreen onChange={onSettingsChanged} onErased={onDataErased} />}
      </main>
    </div>
  )
}
