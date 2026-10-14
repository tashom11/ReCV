import { useState } from 'react'
import { messageErreur } from '../erreurs'
import { lieuEnregistrement } from '../parcours'
import { Alerte, Bouton, Icone } from '../ui'

/** Fin du parcours : le CV est téléchargé, on peut l'ouvrir ou repartir pour une autre annonce. */
export function EcranSucces({
  chemin,
  titrePoste,
  onAutreOffre,
}: {
  /** Fichier écrit par le téléchargement. */
  chemin: string
  titrePoste: string
  onAutreOffre: () => void
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const { fichier, lieu } = lieuEnregistrement(chemin)
  const extension = fichier.toLowerCase().endsWith('.docx') ? 'Word' : 'PDF'

  const ouvrir = (action: (chemin: string) => Promise<void>) => {
    setErreur(null)
    action(chemin).catch((e) => setErreur(messageErreur(e)))
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-14 text-center">
      <span
        className="coche-succes mx-auto flex size-[120px] items-center justify-center rounded-full bg-accent text-encre ring-[14px] ring-accent-pale"
        aria-hidden="true"
      >
        <Icone nom="coche" taille={56} epaisseur={3} />
      </span>
      <header className="space-y-3">
        <h1 className="font-titre text-[2.75rem] leading-tight font-bold">Votre CV est prêt à envoyer</h1>
        <p className="mx-auto max-w-xl text-intro text-encre-douce">
          Il est adapté à l’annonce « {titrePoste} ». Bonne chance pour votre candidature !
        </p>
      </header>

      <section className="space-y-5 rounded-carte border border-trait bg-surface p-6 text-left shadow-carte">
        <div className="flex items-center gap-4">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-bouton bg-erreur-fond text-petit font-bold text-erreur">
            {extension}
          </span>
          <div className="min-w-0">
            <p className="truncate text-intro font-bold">{fichier}</p>
            <p className="text-corps text-encre-douce">{lieu}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Bouton icone="dossier" onClick={() => ouvrir(window.api.revealInFolder)}>
            Ouvrir le dossier
          </Bouton>
          <Bouton variante="secondaire" onClick={() => ouvrir(window.api.openFile)}>
            Ouvrir le CV
          </Bouton>
        </div>
        {erreur && (
          <Alerte type="avertissement">
            Le fichier ne s’ouvre pas tout seul. Vous le trouverez à cet endroit : {chemin}
          </Alerte>
        )}
      </section>

      <hr className="border-trait" />

      <section className="space-y-4">
        <h2 className="font-titre text-titre-section font-bold">Une autre annonce vous intéresse ?</h2>
        <Bouton variante="contour" taille="grand" icone="recommencer" onClick={onAutreOffre}>
          Adapter pour une autre offre
        </Bouton>
        <p className="text-corps text-encre-douce">
          Votre CV de départ est gardé : vous n’aurez qu’à indiquer la nouvelle annonce.
        </p>
      </section>
    </div>
  )
}
