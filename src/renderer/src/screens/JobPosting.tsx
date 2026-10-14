import type { JobPostingPreview } from '@core/api'
import type { JobPosting } from '@core/schemas'
import { useState } from 'react'
import { describeError, type ErrorAction, type ErrorDescription } from '../errors'
import { announcedDuration } from '../estimate'
import { useTaskProgress } from '../progress'
import { Button, ErrorAlert, LinkButton, Loading, PageTitle } from '../ui'
import { JobPostingCard } from './job-posting/JobPostingCard'
import { type InputMode, JobPostingInput } from './job-posting/JobPostingInput'

export interface ReadJobPosting {
  jobPosting: JobPosting
  preview: JobPostingPreview
}

/** Step ②: link or text of the job posting, then a confirmation card of what was read. */
export function JobPostingScreen({
  posting,
  onJobPosting,
  estimateS,
  generationError,
  onCreate,
  onBackToCv,
  onSetup,
}: {
  posting: ReadJobPosting | null
  onJobPosting: (posting: ReadJobPosting | null) => void
  /** Estimated generation duration, in seconds. */
  estimateS: number
  /** Last generation interrupted by an error, to report above the card. */
  generationError: ErrorDescription | null
  onCreate: () => void
  onBackToCv: () => void
  onSetup: () => void
}) {
  const [mode, setMode] = useState<InputMode>('link')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [busyWith, setBusyWith] = useState<'reading' | 'analysis' | null>(null)
  const [error, setError] = useState<ErrorDescription | null>(null)
  const progress = useTaskProgress('job-posting', busyWith !== null)

  // Reads the job posting (link, text or a corrected version), then spots what the employer is looking for: the
  // confirmation card depends on it.
  const read = async (source: InputMode | JobPosting) => {
    setError(null)
    setBusyWith('reading')
    try {
      const jobPosting =
        typeof source !== 'string'
          ? source
          : source === 'link'
            ? await window.api.fetchJobPosting(url.trim())
            : await window.api.parseJobPostingText(text)
      setBusyWith('analysis')
      onJobPosting({ jobPosting, preview: await window.api.previewJobPosting(jobPosting) })
    } catch (e) {
      setError(describeError('posting', e))
    } finally {
      setBusyWith(null)
    }
  }

  const onErrorAction = (action: ErrorAction) => {
    setError(null)
    if (action === 'paste-text') setMode('text')
    else if (action === 'finish-setup') onSetup()
    else void read(posting ? posting.jobPosting : mode)
  }

  const loading = busyWith && (
    <Loading
      title={
        busyWith === 'reading' && mode === 'link' ? 'Nous ouvrons la page de l’annonce…' : 'Nous lisons l’annonce…'
      }
      step={progress ? 'Nous repérons le poste et ce que l’employeur recherche' : undefined}
      note="Cela prend généralement moins d’une minute."
    />
  )

  if (posting) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-7 px-6 py-12">
        <PageTitle kicker="Annonce lue">C’est bien cette annonce ?</PageTitle>
        {generationError && (
          <ErrorAlert
            description={generationError}
            onAction={(action) => (action === 'finish-setup' ? onSetup() : onCreate())}
          />
        )}
        {error && <ErrorAlert description={error} onAction={onErrorAction} />}

        <JobPostingCard
          // A new reading (correction) starts a new card: the correction form closes.
          key={`${posting.jobPosting.jobTitle}\n${posting.jobPosting.rawText}`}
          jobPosting={posting.jobPosting}
          preview={posting.preview}
          onReread={(corrected) => void read(corrected)}
          busy={busyWith !== null}
          loading={loading}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <LinkButton icon="arrow-left" onClick={() => onJobPosting(null)}>
            Ce n’est pas la bonne annonce
          </LinkButton>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-corps text-encre-douce">{announcedDuration(estimateS)}</span>
            <Button size="large" endIcon="arrow-right" onClick={onCreate} disabled={busyWith !== null}>
              Créer mon CV adapté
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <PageTitle subtitle="Donnez-nous l’adresse de l’annonce. Si le site ne se laisse pas lire, collez simplement son texte.">
        Quelle annonce vous intéresse ?
      </PageTitle>
      {error && <ErrorAlert description={error} onAction={onErrorAction} />}

      <JobPostingInput
        mode={mode}
        onMode={setMode}
        url={url}
        onUrl={setUrl}
        text={text}
        onText={setText}
        onRead={() => void read(mode)}
        busy={busyWith !== null}
        loading={loading}
      />

      <LinkButton icon="arrow-left" onClick={onBackToCv}>
        Revenir à mon CV
      </LinkButton>
    </div>
  )
}
