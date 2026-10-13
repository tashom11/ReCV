import type { ModeleEmbarqueEtat, ProgressionModele } from '@core/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type DescriptionErreur, decrireErreur } from '../erreurs'
import { debit, formaterTaille, restantTelechargement } from '../estimation'
import { AlerteErreur, Bouton, BoutonLien, Icone } from '../ui'

/**
 * Préparation du premier lancement : le fichier dont Re:CV a besoin pour travailler sans internet se télécharge
 * une seule fois. Le détail (quel modèle, quelles alternatives) reste dans les Réglages.
 */
export function EcranPreparation({
  onPret,
  onPlusTard,
  onReglages,
}: {
  onPret: () => void
  onPlusTard: () => void
  onReglages: () => void
}) {
  const [modele, setModele] = useState<ModeleEmbarqueEtat | null>(null)
  const [progression, setProgression] = useState<ProgressionModele | null>(null)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  const [restant, setRestant] = useState<string | null>(null)
  // Premier relevé de la session : le débit se mesure depuis là (une reprise ne repart pas de zéro octet).
  const depart = useRef<{ octets: number; instantMs: number } | null>(null)
  const lance = useRef(false)

  const telecharger = useCallback(async (id: string) => {
    setErreur(null)
    depart.current = null
    try {
      await window.api.telechargerModele(id)
    } catch (e) {
      // Déjà en cours (lancé depuis les Réglages) : on suit simplement sa progression.
      const etat = await window.api.lireEtatModeles().catch(() => null)
      if (!etat?.telechargement) setErreur(decrireErreur('preparation', e))
    }
  }, [])

  useEffect(() => {
    const desabonner = window.api.surProgressionModele((p) => {
      setProgression(p)
      if (p.etat === 'en-cours') {
        const releve = { octets: p.recuOctets, instantMs: Date.now() }
        depart.current ??= releve
        setRestant(restantTelechargement(p.recuOctets, p.totalOctets, debit(depart.current, releve)))
      }
      if (p.etat === 'termine') onPret()
    })
    if (!lance.current) {
      lance.current = true
      window.api.lireEtatModeles().then(
        (etat) => {
          const choisi = etat.modeles.find((m) => m.recommande) ?? etat.modeles[0]
          if (!choisi) return
          setModele(choisi)
          if (etat.modeles.some((m) => m.installe)) onPret()
          else if (etat.telechargement) setProgression(etat.telechargement)
          else void telecharger(choisi.id)
        },
        (e) => setErreur(decrireErreur('preparation', e)),
      )
    }
    return desabonner
  }, [onPret, telecharger])

  const total = progression?.totalOctets || modele?.tailleOctets || 0
  const recu = progression?.recuOctets ?? 0
  const pourcentage = total > 0 ? Math.min(100, Math.round((recu / total) * 100)) : 0
  const verification = progression?.etat === 'verification'
  const interrompu = progression?.etat === 'erreur' && !erreur

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14">
      <section className="space-y-7 rounded-panneau border border-trait bg-surface p-10 shadow-panneau">
        <header className="flex items-center gap-5">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-carte border border-accent bg-accent-pale text-encre"
            aria-hidden="true"
          >
            <Icone nom="telecharger" taille={28} />
          </span>
          <h1 className="font-titre text-titre-ecran font-bold">On prépare Re:CV</h1>
        </header>
        <p className="text-intro text-encre-douce">
          Pour travailler sans rien envoyer sur internet, Re:CV a besoin d’un fichier
          {modele ? (
            <>
              {' '}
              d’environ <strong className="text-encre">{formaterTaille(modele.tailleOctets)}</strong>
            </>
          ) : (
            ' volumineux'
          )}
          . Il se télécharge <strong className="text-encre">une seule fois</strong> ; ensuite, l’application fonctionne
          même sans connexion.
        </p>

        {erreur || interrompu ? (
          <AlerteErreur
            description={erreur ?? decrireErreur('preparation', progression?.message ?? 'Téléchargement interrompu')}
            surAction={() => modele && void telecharger(modele.id)}
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[1.5rem] font-bold tabular-nums" aria-hidden="true">
                {pourcentage} %
              </span>
              <span className="text-corps text-encre-douce" role="status">
                {verification
                  ? 'Vérification du fichier… quelques secondes'
                  : total > 0
                    ? `${formaterTaille(recu)} sur ${formaterTaille(total)}${restant ? ` · ${restant}` : ''}`
                    : 'Démarrage…'}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Téléchargement"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pourcentage}
              className="h-3.5 overflow-hidden rounded-full bg-creux"
            >
              {verification ? (
                <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
              ) : (
                <div
                  className="h-full rounded-full bg-marque transition-all duration-500"
                  style={{ width: `${pourcentage}%` }}
                />
              )}
            </div>
          </div>
        )}

        <ul className="space-y-3 rounded-carte bg-papier p-6 text-corps text-encre">
          {[
            'Gardez l’ordinateur allumé et connecté à internet. Vous pouvez réduire cette fenêtre.',
            'Si la connexion coupe, le téléchargement reprendra là où il s’était arrêté.',
          ].map((ligne) => (
            <li key={ligne} className="flex items-start gap-3.5">
              <Icone nom="coche" taille={18} epaisseur={2.5} className="mt-1 text-marque" />
              {ligne}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Bouton
            variante="secondaire"
            onClick={() => {
              void window.api.annulerTelechargement()
              onPlusTard()
            }}
          >
            Plus tard
          </Bouton>
          <BoutonLien onClick={onReglages}>Choisir une autre option dans les Réglages</BoutonLien>
        </div>
      </section>
    </div>
  )
}
