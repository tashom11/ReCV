import type { GeneratedCv } from '@core/api'
import type { JobPosting, Profile } from '@core/schemas'
import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from './app/AppHeader'
import { useEngineStatus } from './app/useEngineStatus'
import { useNavigation } from './app/useNavigation'
import { describeError, type ErrorDescription, isCancellation } from './errors'
import { readEstimate, saveDuration } from './estimate'
import { afterStart, doneSteps, initialView, titleWithoutGender, viewForStep } from './flow'
import { texts } from './i18n'
import { GeneratingScreen } from './screens/Generating'
import { JobPostingScreen, type ReadJobPosting } from './screens/JobPosting'
import { MyCvScreen } from './screens/MyCv'
import { NewCvScreen } from './screens/NewCv'
import { SettingsScreen } from './screens/Settings'
import { SetupScreen } from './screens/Setup'
import { SuccessScreen } from './screens/Success'
import { useUpdateState } from './screens/Updates'
import { WelcomeScreen } from './screens/Welcome'
import { Alert, Button, EmptyState } from './ui'

interface Result {
  /** Profile at the time of creation: the experience indices must match it. */
  profile: Profile
  jobPosting: JobPosting
  generated: GeneratedCv
}

const FILE_NAME_KEY = 'recv.nomFichierCv'

export default function App() {
  const { view, setView, goTo, goBack, returnView } = useNavigation()
  const { engine, checkEngine } = useEngineStatus()
  const update = useUpdateState()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fileName, setFileName] = useState<string | null>(() => localStorage.getItem(FILE_NAME_KEY))
  const [posting, setPosting] = useState<ReadJobPosting | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<ErrorDescription | null>(null)
  const [layingOut, setLayingOut] = useState(false)
  const [estimate, setEstimate] = useState(() => readEstimate(localStorage))

  useEffect(() => {
    void checkEngine()
    window.api.getProfile().then(
      (existing) => {
        if (existing) setProfile(existing.profile)
        setView(initialView(existing !== null))
      },
      () => setView('welcome'),
    )
  }, [checkEngine, setView])

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
      // Last announced step: the result screen lays the CV out (its previews are computed there).
      setLayingOut(true)
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
  }, [goTo, returnView])

  const onSettingsChanged = useCallback(() => void checkEngine(), [checkEngine])

  const onReady = useCallback(() => {
    void checkEngine()
    goBack()
  }, [goBack, checkEngine])

  if (view === null) return <div className="min-h-screen bg-papier" />

  const done = doneSteps({
    profilePresent: profile !== null,
    postingConfirmed: result !== null || view === 'generating',
    exported: exportedPath !== null,
  })
  // Nothing can be read nor created without an engine: say so where it is needed, with the action to fix it.
  const engineMissing = !engine.ready && (view === 'cv' || view === 'posting')

  return (
    <div className="flex min-h-screen flex-col bg-papier text-encre">
      <AppHeader
        view={view}
        done={done}
        hasUndownloadedCv={result !== null && !exportedPath}
        updateReady={update?.status === 'ready'}
        onGoToStep={(step) => goTo(viewForStep(step))}
        onSettings={() => goTo('settings')}
        onBack={() => goTo(returnView.current)}
      />

      <main className="ecrans flex flex-1 flex-col">
        {engineMissing && (
          <div className="mx-auto w-full max-w-4xl px-6 pt-8">
            <Alert
              type="warning"
              title={texts.emptyStates.notReady.title}
              actions={
                <Button size="small" onClick={goToSetup}>
                  {texts.emptyStates.notReady.action}
                </Button>
              }
            >
              {texts.emptyStates.notReady.text}
            </Alert>
          </div>
        )}

        {view === 'welcome' && (
          <WelcomeScreen
            online={engine.online}
            onStart={() => {
              returnView.current = 'welcome'
              void checkEngine().then((status) => goTo(afterStart(status.ready)))
            }}
          />
        )}
        {view === 'setup' && <SetupScreen onReady={onReady} onLater={goBack} onSettings={() => goTo('settings')} />}
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
              onJobPosting={(read) => {
                setPosting(read)
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
                title={texts.emptyStates.noCv.title}
                text={texts.emptyStates.noCv.text}
                action={<Button onClick={() => goTo('cv')}>{texts.emptyStates.noCv.action}</Button>}
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
              title={texts.emptyStates.noTailoredCv.title}
              text={texts.emptyStates.noTailoredCv.text}
              action={
                <Button onClick={() => goTo(profile ? 'posting' : 'cv')}>
                  {profile ? texts.emptyStates.noTailoredCv.toPosting : texts.emptyStates.noTailoredCv.toCv}
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
