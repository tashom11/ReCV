import type { ErrorAction, ErrorDescription } from '../../errors'
import { texts } from '../../i18n'
import { DropZone, ErrorAlert, Icon, Loading, PageTitle } from '../../ui'

/** Step ① before any CV: drop zone (or file picker), import progress and the privacy promise. */
export function CvImportStep({
  error,
  onErrorAction,
  importing,
  showProgressStep,
  online,
  onFile,
  onChoose,
}: {
  error: ErrorDescription | null
  onErrorAction: (action: ErrorAction) => void
  importing: boolean
  /** The main process has reported the reading step: it can be named. */
  showProgressStep: boolean
  /** An online service is chosen in the settings: do not promise that nothing is sent. */
  online: boolean
  onFile: (file: File) => void
  onChoose: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <PageTitle subtitle={texts.myCv.import.subtitle}>{texts.myCv.import.title}</PageTitle>
      {error && <ErrorAlert description={error} onAction={onErrorAction} />}
      {importing ? (
        <Loading
          title={texts.myCv.import.reading}
          step={showProgressStep ? texts.myCv.import.readingStep : undefined}
          note={texts.myCv.import.readingNote}
        />
      ) : (
        <DropZone onFile={onFile} onChoose={onChoose} />
      )}
      <p className="flex items-center gap-3 text-intro text-encre">
        <Icon name="lock" className="text-marque" />
        {online ? texts.myCv.import.privacyOnline : texts.myCv.import.privacyLocal}
      </p>
    </div>
  )
}
