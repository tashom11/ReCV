import type { CvGenere } from '@core/api'
import type { CvAdapte, Offre, Profil } from '@core/schemas'
import { useEffect, useState } from 'react'
import logo from './assets/logo.png'
import { EcranDiff } from './ecrans/Diff'
import { EcranOffre } from './ecrans/Offre'
import { EcranParametres } from './ecrans/Parametres'
import { EcranProfil } from './ecrans/Profil'
import { Alerte, BoutonLien, Etapes, Icone, type NumeroEtape } from './ui'

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

  const etapeCourante: NumeroEtape | null = ecran === 'profil' ? 1 : ecran === 'offre' ? 2 : ecran === 'diff' ? 3 : null
  const faites: NumeroEtape[] = [...(profil ? [1 as const] : []), ...(resultat ? [2 as const] : [])]
  const allerEtape = (etape: NumeroEtape) => setEcran(etape === 1 ? 'profil' : etape === 2 ? 'offre' : 'diff')

  return (
    <div className="min-h-screen bg-papier text-encre">
      <header className="sticky top-0 z-20 border-b border-trait bg-surface">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center gap-8 px-6">
          <span className="flex items-center gap-3 font-titre text-2xl font-bold text-encre">
            <img src={logo} alt="" width={40} height={40} className="rounded-champ" />
            Re:CV
          </span>
          {ecran === 'parametres' ? (
            <span className="flex-1" />
          ) : (
            <Etapes courante={etapeCourante} faites={faites} onAller={allerEtape} />
          )}
          {ecran === 'parametres' ? (
            <BoutonLien icone="fleche-gauche" onClick={() => setEcran(profil ? 'offre' : 'profil')}>
              Revenir où j’en étais
            </BoutonLien>
          ) : (
            <button
              type="button"
              onClick={() => setEcran('parametres')}
              className="inline-flex min-h-11 items-center gap-2 rounded-bouton px-2 text-encre hover:text-marque"
            >
              <Icone nom="reglages" taille={22} />
              Réglages
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
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
