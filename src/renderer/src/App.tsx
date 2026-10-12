import type { CvGenere } from '@core/api'
import type { CvAdapte, Offre, Profil } from '@core/schemas'
import { useEffect, useState } from 'react'
import { EcranDiff } from './ecrans/Diff'
import { EcranOffre } from './ecrans/Offre'
import { EcranParametres } from './ecrans/Parametres'
import { EcranProfil } from './ecrans/Profil'
import { Alerte } from './ui'

type Ecran = 'profil' | 'offre' | 'diff' | 'parametres'

interface Resultat {
  /** Profil au moment de la génération : les indices des expériences doivent correspondre. */
  profil: Profil
  offre: Offre
  genere: CvGenere
}

export default function App() {
  const [ecran, setEcran] = useState<Ecran>('profil')
  const [profil, setProfil] = useState<Profil | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  // Le CV validé servira à l’export (PDF/DOCX) à la prochaine étape.
  const [, setCvValide] = useState<CvAdapte | null>(null)

  const [modeleManquant, setModeleManquant] = useState(false)

  // Premier lancement : le modèle embarqué est le fournisseur par défaut mais n'est pas encore téléchargé.
  useEffect(() => {
    if (ecran === 'parametres') return
    Promise.all([window.api.lireParametres(), window.api.lireEtatModeles()]).then(
      ([p, m]) =>
        setModeleManquant(p.fournisseur === 'local' && !p.cheminModeleLocal && !m.modeles.some((x) => x.installe)),
      () => undefined,
    )
  }, [ecran])

  useEffect(() => {
    window.api.obtenirProfil().then(
      (existant) => existant && setProfil(existant.profil),
      () => undefined,
    )
  }, [])

  const onglets: { id: Ecran; nom: string; actif: boolean }[] = [
    { id: 'profil', nom: 'Profil', actif: true },
    { id: 'offre', nom: 'Offre', actif: true },
    { id: 'diff', nom: 'Vérification', actif: resultat !== null },
    { id: 'parametres', nom: 'Paramètres', actif: true },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-6 px-6">
          <span className="py-3 text-base font-semibold text-indigo-600">Re:CV</span>
          {onglets.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={!o.actif}
              onClick={() => setEcran(o.id)}
              className={`border-b-2 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                ecran === o.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {o.nom}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {modeleManquant && ecran !== 'parametres' && (
          <div className="mb-6">
            <Alerte type="avertissement">
              Aucun modèle de langage n’est installé.{' '}
              <button type="button" className="font-medium underline" onClick={() => setEcran('parametres')}>
                Télécharger un modèle
              </button>{' '}
              (ou configurer Ollama / une API dans les paramètres).
            </Alerte>
          </div>
        )}
        {ecran === 'profil' && <EcranProfil profil={profil} onProfil={setProfil} onSuivant={() => setEcran('offre')} />}
        {ecran === 'offre' && (
          <EcranOffre
            profilPresent={profil !== null}
            onResultat={(offre, genere) => {
              if (profil) setResultat({ profil, offre, genere })
              setCvValide(null)
              setEcran('diff')
            }}
          />
        )}
        {ecran === 'diff' && resultat && (
          <EcranDiff
            key={resultat.genere.id}
            profil={resultat.profil}
            offre={resultat.offre}
            adapte={resultat.genere.cv}
            onValider={setCvValide}
            onRetour={() => setEcran('offre')}
          />
        )}
        {ecran === 'parametres' && <EcranParametres />}
      </main>
    </div>
  )
}
