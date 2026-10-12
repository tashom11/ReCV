import type { EtatModeles, ProgressionModele } from '@core/api'
import { useCallback, useEffect, useState } from 'react'
import { Alerte, Bouton, Carte, messageErreur } from '../ui'

const formaterTaille = (octets: number) =>
  octets >= 1024 ** 3 ? `${(octets / 1024 ** 3).toFixed(1)} Go` : `${Math.round(octets / 1024 ** 2)} Mo`

export function GestionModeles({ onChange }: { onChange: () => void }) {
  const [etat, setEtat] = useState<EtatModeles | null>(null)
  const [progression, setProgression] = useState<ProgressionModele | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const rafraichir = useCallback(() => {
    window.api.lireEtatModeles().then(
      (e) => {
        setEtat(e)
        setProgression(e.telechargement)
      },
      (e) => setErreur(messageErreur(e)),
    )
  }, [])

  useEffect(() => {
    rafraichir()
    return window.api.surProgressionModele((p) => {
      setProgression(p)
      if (p.etat === 'termine') {
        rafraichir()
        onChange()
      }
      if (p.etat === 'annule' || p.etat === 'erreur') rafraichir()
    })
  }, [rafraichir, onChange])

  const enCours = progression?.etat === 'en-cours' || progression?.etat === 'verification'

  const lancer = async (id: string) => {
    setErreur(null)
    try {
      await window.api.telechargerModele(id)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const supprimer = async (id: string) => {
    setErreur(null)
    try {
      await window.api.supprimerModele(id)
      rafraichir()
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  if (!etat) return null

  return (
    <Carte titre="Modèles embarqués">
      <p className="text-xs text-slate-600">
        Ton ordinateur : {etat.ramGo} Go de RAM
        {etat.vramGo > 0 ? `, ${etat.vramGo} Go de mémoire graphique` : ', pas de carte graphique exploitable'}. Le
        modèle recommandé est téléchargé une seule fois depuis Hugging Face, puis fonctionne hors ligne.
      </p>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <ul className="space-y-3">
        {etat.modeles.map((m) => {
          const actif = progression?.id === m.id && enCours
          const pct =
            progression && progression.totalOctets > 0 ? (progression.recuOctets / progression.totalOctets) * 100 : 0
          return (
            <li key={m.id} className="space-y-2 rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {m.nom} <span className="font-normal text-slate-500">· {formaterTaille(m.tailleOctets)}</span>
                    {m.recommande && (
                      <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                        Recommandé
                      </span>
                    )}
                    {m.installe && (
                      <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-800">Installé</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">{m.description}</p>
                  {!m.compatible && (
                    <p className="text-xs text-amber-700">Probablement trop lourd pour la mémoire de cet ordinateur.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {m.installe ? (
                    <Bouton variante="danger" desactive={enCours} onClick={() => supprimer(m.id)}>
                      Supprimer
                    </Bouton>
                  ) : actif ? (
                    <Bouton variante="secondaire" onClick={() => window.api.annulerTelechargement()}>
                      Annuler
                    </Bouton>
                  ) : (
                    <Bouton desactive={enCours} onClick={() => lancer(m.id)}>
                      Télécharger
                    </Bouton>
                  )}
                </div>
              </div>
              {actif && progression && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-600">
                    {progression.etat === 'verification'
                      ? 'Vérification du fichier…'
                      : `${formaterTaille(progression.recuOctets)} / ${formaterTaille(progression.totalOctets)} (${Math.round(pct)} %)`}
                  </p>
                </div>
              )}
              {progression?.id === m.id && progression.etat === 'annule' && (
                <p className="text-xs text-slate-600">Téléchargement interrompu : il reprendra où il s’est arrêté.</p>
              )}
            </li>
          )
        })}
      </ul>
    </Carte>
  )
}
