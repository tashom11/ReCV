import type { UpdateState } from '@core/api'
import { useEffect, useState } from 'react'
import { Bouton, Carte, Icone, type NomIcone, Spinner } from '../ui'

/** État de la mise à jour, suivi en direct (lecture initiale puis changements envoyés par l'application). */
export function useMiseAJour(): UpdateState | null {
  const [etat, setEtat] = useState<UpdateState | null>(null)
  useEffect(() => {
    window.api.getUpdateState().then(setEtat, () => undefined)
    return window.api.onUpdate(setEtat)
  }, [])
  return etat
}

const heure = (instantMs: number) =>
  new Date(instantMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

function decrire(etat: UpdateState): { icone: NomIcone | null; ton: string; texte: string } {
  switch (etat.status) {
    case 'a-jour':
      return {
        icone: 'coche-cercle',
        ton: 'text-marque',
        texte: `Re:CV est à jour${etat.checkedAt ? ` (vérifié à ${heure(etat.checkedAt)})` : ''}.`,
      }
    case 'verification':
      return { icone: null, ton: 'text-encre', texte: 'Recherche d’une mise à jour…' }
    case 'telechargement':
      return {
        icone: null,
        ton: 'text-encre',
        texte: `Téléchargement de la version ${etat.newVersion ?? 'suivante'}… ${etat.percent ?? 0} %`,
      }
    case 'prete':
      return {
        icone: 'telecharger',
        ton: 'text-marque',
        texte: `La version ${etat.newVersion ?? 'suivante'} est prête. Elle s’installera à la fermeture de Re:CV.`,
      }
    case 'erreur':
      return {
        icone: 'alerte',
        ton: 'text-alerte',
        texte: 'Impossible de vérifier les mises à jour pour l’instant. Vérifiez votre connexion, puis réessayez.',
      }
    case 'indisponible':
      return {
        icone: 'info',
        ton: 'text-encre-douce',
        texte: 'Les mises à jour automatiques ne concernent que l’application installée.',
      }
    default:
      return { icone: 'info', ton: 'text-encre-douce', texte: 'Aucune vérification pour l’instant.' }
  }
}

/** Réglages : version installée, état de la mise à jour, vérification à la demande et redémarrage. */
export function CarteMisesAJour() {
  const etat = useMiseAJour()
  const [demande, setDemande] = useState(false)
  if (!etat) return null

  const { icone, ton, texte } = decrire(etat)
  const occupe = demande || etat.status === 'verification' || etat.status === 'telechargement'

  const verifier = () => {
    setDemande(true)
    window.api
      .checkForUpdate()
      .catch(() => undefined)
      .finally(() => setDemande(false))
  }

  return (
    <Carte titre="Mises à jour" sousTitre={`Version installée : ${etat.version}`}>
      <p role="status" aria-live="polite" className={`flex items-start gap-2.5 text-corps font-bold ${ton}`}>
        {icone ? <Icone nom={icone} className="mt-0.5" /> : <Spinner taille={20} />}
        {texte}
      </p>
      {etat.status === 'telechargement' && (
        <div
          role="progressbar"
          aria-label="Téléchargement de la mise à jour"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={etat.percent ?? 0}
          className="h-2.5 overflow-hidden rounded-full bg-creux"
        >
          <div className="h-full rounded-full bg-marque transition-all" style={{ width: `${etat.percent ?? 0}%` }} />
        </div>
      )}
      {etat.status === 'erreur' && etat.message && (
        <details>
          <summary className="inline-flex min-h-11 items-center font-bold text-marque underline underline-offset-4">
            Détails
          </summary>
          <p className="rounded-champ bg-papier p-3 font-mono text-petit break-words text-encre-douce">
            {etat.message}
          </p>
        </details>
      )}
      {etat.status === 'prete' ? (
        <Bouton icone="recommencer" onClick={() => void window.api.installUpdate().catch(() => undefined)}>
          Redémarrer maintenant
        </Bouton>
      ) : (
        etat.status !== 'indisponible' && (
          <Bouton variante="secondaire" icone="recommencer" onClick={verifier} enCours={occupe}>
            Rechercher une mise à jour
          </Bouton>
        )
      )}
    </Carte>
  )
}
