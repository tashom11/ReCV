import { useEffect, useState } from 'react'
import { avancement, depuis, dureeAnnoncee, restantCreation, SEUIL_LONG_S } from '../estimation'
import { ETAPES_CREATION, etapeCreationCourante } from '../parcours'
import { useProgressionTache, useSecondesEcoulees } from '../progression'
import { Alerte, Bouton, Icone, IllustrationCv, Spinner } from '../ui'

/** Attente pendant la création du CV adapté : étapes nommées, temps estimé, annulation possible. */
export function EcranCreation({
  titrePoste,
  annonceLue,
  miseEnPage,
  estimationS,
  enLigne,
  onAnnuler,
}: {
  titrePoste: string
  /** L'annonce a déjà été analysée à l'étape ② : la première ligne est faite d'emblée. */
  annonceLue: boolean
  /** Le contenu est prêt, l'aperçu se prépare (dernière ligne). */
  miseEnPage: boolean
  estimationS: number
  /** Un service en ligne fait le travail : on ne dit pas que rien ne sort de l'ordinateur. */
  enLigne: boolean
  onAnnuler: () => void
}) {
  const progression = useProgressionTache('adaptation', true)
  const secondes = useSecondesEcoulees(true)
  const [annulation, setAnnulation] = useState(false)
  const [patiente, setPatiente] = useState(false)
  const courante = etapeCreationCourante(progression?.cle, annonceLue, miseEnPage)
  const part = miseEnPage ? 1 : Math.max(avancement(secondes, estimationS), courante / ETAPES_CREATION.length)
  const long = secondes >= SEUIL_LONG_S && !patiente && !miseEnPage

  // Le temps tourne à l'écran, mais seuls les changements d'étape sont annoncés aux lecteurs d'écran.
  const [annonce, setAnnonce] = useState('')
  useEffect(() => setAnnonce(`${ETAPES_CREATION[courante]} : en cours`), [courante])

  const annuler = () => {
    setAnnulation(true)
    onAnnuler()
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-[360px_1fr]">
      <div className="hidden lg:block">
        <IllustrationCv />
      </div>

      <div className="max-w-2xl space-y-6">
        <header className="space-y-3">
          <h1 className="font-titre text-titre-ecran font-bold">Nous préparons votre CV pour « {titrePoste} »</h1>
          <p className="text-intro text-encre-douce">
            {dureeAnnoncee(estimationS)}. Vous pouvez réduire la fenêtre en attendant.
          </p>
        </header>

        <p className="sr-only" role="status" aria-live="polite">
          {annonce}
        </p>
        <ol className="space-y-1">
          {ETAPES_CREATION.map((etape, i) => {
            const etat = i < courante ? 'fait' : i === courante ? 'en-cours' : 'a-venir'
            return (
              <li
                key={etape}
                className={`flex min-h-[52px] items-center gap-4 rounded-bouton px-3 ${
                  etat === 'en-cours'
                    ? 'border border-trait bg-surface font-bold shadow-carte'
                    : 'border border-transparent'
                }`}
              >
                {etat === 'fait' ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marque text-white">
                    <Icone nom="coche" taille={18} epaisseur={3} />
                  </span>
                ) : etat === 'en-cours' ? (
                  <span className="flex size-8 shrink-0 items-center justify-center text-marque">
                    <Spinner taille={24} />
                  </span>
                ) : (
                  <span className="size-8 shrink-0 rounded-full border-2 border-dashed border-trait-fort" />
                )}
                <span className={`flex-1 text-intro ${etat === 'a-venir' ? 'text-encre-douce' : 'text-encre'}`}>
                  {etape}
                </span>
                <span
                  className={`text-libelle ${etat === 'fait' ? 'font-bold text-marque' : etat === 'en-cours' ? 'text-encre' : 'text-encre-douce'}`}
                >
                  {etat === 'fait' ? 'Fait' : etat === 'en-cours' ? 'En cours' : 'À venir'}
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
            <span>{depuis(secondes)}</span>
            <span>{miseEnPage ? 'Presque terminé' : restantCreation(secondes, estimationS)}</span>
          </p>
        </div>

        {long ? (
          <Alerte
            type="info"
            icone="minuteur"
            titre="C’est plus long que prévu, mais ça avance"
            actions={
              <>
                <Bouton variante="secondaire" taille="petit" onClick={() => setPatiente(true)}>
                  Continuer d’attendre
                </Bouton>
                <Bouton variante="secondaire" taille="petit" onClick={annuler} enCours={annulation}>
                  Annuler
                </Bouton>
              </>
            }
          >
            {progression?.calcul === 'cpu'
              ? 'Votre ordinateur calcule sans aide de la carte graphique. '
              : 'Votre ordinateur calcule encore. '}
            Pour aller plus vite la prochaine fois, choisissez « Rapide » dans les Réglages.
          </Alerte>
        ) : (
          <p className="flex items-start gap-3 rounded-carte border border-trait bg-surface px-5 py-4 text-corps text-encre">
            <Icone nom="cadenas" className="mt-0.5 text-marque" />
            {enLigne
              ? 'Votre CV et l’annonce sont envoyés au service en ligne choisi dans les Réglages, le temps de la création.'
              : 'Votre ordinateur fait tout le travail lui-même : c’est parfois un peu long, mais rien ne sort de chez vous.'}
          </p>
        )}

        {!long && (
          <Bouton variante="secondaire" onClick={annuler} enCours={annulation} desactive={miseEnPage}>
            Annuler
          </Bouton>
        )}
      </div>
    </div>
  )
}
