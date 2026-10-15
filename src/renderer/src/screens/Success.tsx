import { useState } from 'react'
import { errorMessage } from '../errors'
import { savedLocation } from '../flow'
import { texts } from '../i18n'
import { Alert, Button, Icon } from '../ui'

/** End of the flow: the CV is downloaded, it can be opened or the user can start again for another job posting. */
export function SuccessScreen({
  path,
  jobTitle,
  onAnotherPosting,
}: {
  /** File written by the download. */
  path: string
  jobTitle: string
  onAnotherPosting: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const { file, place } = savedLocation(path)
  const extension = file.toLowerCase().endsWith('.docx') ? 'Word' : 'PDF'

  const open = (action: (path: string) => Promise<void>) => {
    setError(null)
    action(path).catch((e) => setError(errorMessage(e)))
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 sm:px-10 lg:px-16 py-14 sm:py-20 text-center">
      <span
        className="coche-succes mx-auto flex size-[120px] items-center justify-center rounded-full bg-accent text-encre ring-[14px] ring-accent-pale"
        aria-hidden="true"
      >
        <Icon name="check" size={56} strokeWidth={3} />
      </span>
      <header className="space-y-3">
        <h1 className="font-titre text-[2.75rem] leading-tight font-bold">{texts.success.title}</h1>
        <p className="mx-auto max-w-xl text-intro text-encre-douce">{texts.success.tailoredFor(jobTitle)}</p>
      </header>

      <section className="space-y-5 rounded-carte border border-trait bg-surface p-6 text-left shadow-carte">
        <div className="flex items-center gap-4">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-bouton bg-erreur-fond text-petit font-bold text-erreur">
            {extension}
          </span>
          <div className="min-w-0">
            <p className="break-all text-intro font-bold">{file}</p>
            <p className="text-corps text-encre-douce">{place}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button icon="folder" onClick={() => open(window.api.revealInFolder)}>
            {texts.success.openFolder}
          </Button>
          <Button variant="secondary" onClick={() => open(window.api.openFile)}>
            {texts.success.openCv}
          </Button>
        </div>
        {error && <Alert type="warning">{texts.success.openFailed(path)}</Alert>}
      </section>

      <hr className="border-trait" />

      <section className="space-y-4">
        <h2 className="font-titre text-titre-section font-bold">{texts.success.anotherTitle}</h2>
        <Button variant="outline" size="large" icon="restart" onClick={onAnotherPosting}>
          {texts.success.another}
        </Button>
        <p className="text-corps text-encre-douce">{texts.success.anotherText}</p>
      </section>
    </div>
  )
}
