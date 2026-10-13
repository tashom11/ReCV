import type { ProgressionTache } from '@core/api'
import { useEffect, useState } from 'react'

/** Dernière étape signalée par le process principal pour `tache`, tant que `actif` est vrai. */
export function useProgressionTache(tache: ProgressionTache['tache'], actif: boolean): ProgressionTache | null {
  const [progression, setProgression] = useState<ProgressionTache | null>(null)

  useEffect(() => {
    if (!actif) {
      setProgression(null)
      return
    }
    return window.api.surProgressionTache((p) => {
      if (p.tache === tache) setProgression(p)
    })
  }, [tache, actif])

  return progression
}

/** Secondes écoulées depuis que `actif` est devenu vrai (0 quand inactif). */
export function useSecondesEcoulees(actif: boolean): number {
  const [secondes, setSecondes] = useState(0)

  useEffect(() => {
    if (!actif) {
      setSecondes(0)
      return
    }
    const debut = Date.now()
    const minuteur = setInterval(() => setSecondes(Math.floor((Date.now() - debut) / 1000)), 1000)
    return () => clearInterval(minuteur)
  }, [actif])

  return secondes
}

export function formaterDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60)
  return `${minutes}:${String(secondes % 60).padStart(2, '0')}`
}
