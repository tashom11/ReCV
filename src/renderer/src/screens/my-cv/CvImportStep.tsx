import type { ErrorAction, ErrorDescription } from '../../errors'
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
      <PageTitle subtitle="Nous allons le lire pour comprendre votre parcours. Vous pourrez tout vérifier juste après.">
        Commençons par votre CV
      </PageTitle>
      {error && <ErrorAlert description={error} onAction={onErrorAction} />}
      {importing ? (
        <Loading
          title="Nous lisons votre CV…"
          step={showProgressStep ? 'Nous repérons vos expériences, vos compétences et vos formations' : undefined}
          note="Cela prend une à deux minutes. Vous pouvez réduire la fenêtre en attendant."
        />
      ) : (
        <DropZone onFile={onFile} onChoose={onChoose} />
      )}
      <p className="flex items-center gap-3 text-intro text-encre">
        <Icon name="lock" className="text-marque" />
        {online
          ? 'Votre CV sera lu par le service en ligne choisi dans les Réglages : il quitte votre ordinateur.'
          : 'Votre CV reste sur cet ordinateur : il n’est envoyé nulle part.'}
      </p>
    </div>
  )
}
