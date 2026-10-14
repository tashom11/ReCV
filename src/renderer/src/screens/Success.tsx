import { useState } from 'react'
import { errorMessage } from '../errors'
import { savedLocation } from '../flow'
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
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-14 text-center">
      <span
        className="coche-succes mx-auto flex size-[120px] items-center justify-center rounded-full bg-accent text-encre ring-[14px] ring-accent-pale"
        aria-hidden="true"
      >
        <Icon name="check" size={56} strokeWidth={3} />
      </span>
      <header className="space-y-3">
        <h1 className="font-titre text-[2.75rem] leading-tight font-bold">Votre CV est prêt à envoyer</h1>
        <p className="mx-auto max-w-xl text-intro text-encre-douce">
          Il est adapté à l’annonce « {jobTitle} ». Bonne chance pour votre candidature !
        </p>
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
            Ouvrir le dossier
          </Button>
          <Button variant="secondary" onClick={() => open(window.api.openFile)}>
            Ouvrir le CV
          </Button>
        </div>
        {error && (
          <Alert type="warning">Le fichier ne s’ouvre pas tout seul. Vous le trouverez à cet endroit : {path}</Alert>
        )}
      </section>

      <hr className="border-trait" />

      <section className="space-y-4">
        <h2 className="font-titre text-titre-section font-bold">Une autre annonce vous intéresse ?</h2>
        <Button variant="outline" size="large" icon="restart" onClick={onAnotherPosting}>
          Adapter pour une autre offre
        </Button>
        <p className="text-corps text-encre-douce">
          Votre CV de départ est gardé : vous n’aurez qu’à indiquer la nouvelle annonce.
        </p>
      </section>
    </div>
  )
}
