import { choixInitial, composerCv } from '@core/adaptation/composition'
import type { CvGenere } from '@core/api'
import type { Offre, Profil } from '@core/schemas'
import { useCallback, useEffect, useRef, useState } from 'react'
import logo from './assets/logo.png'
import { EcranAccueil } from './ecrans/Accueil'
import { type AnnonceLue, EcranAnnonce } from './ecrans/Annonce'
import { EcranCreation } from './ecrans/Creation'
import { EcranMonCv } from './ecrans/MonCv'
import { EcranNouveauCv } from './ecrans/NouveauCv'
import { EcranPreparation } from './ecrans/Preparation'
import { EcranReglages } from './ecrans/Reglages'
import { EcranSucces } from './ecrans/Succes'
import { type DescriptionErreur, decrireErreur, estAnnulation } from './erreurs'
import { enregistrerDuree, lireEstimation } from './estimation'
import {
  apresCommencer,
  enteteDeVue,
  etapeDeVue,
  etapesFaites,
  moteurPret,
  type NumeroEtape,
  titreSansMention,
  type Vue,
  vueDeEtape,
  vueInitiale,
} from './parcours'
import { Alerte, Bouton, BoutonLien, Etapes, EtatVide, Icone } from './ui'

interface Resultat {
  /** Profil au moment de la création : les indices des expériences doivent correspondre. */
  profil: Profil
  offre: Offre
  genere: CvGenere
}

const CLE_NOM_FICHIER = 'recv.nomFichierCv'

export default function App() {
  const [vue, setVue] = useState<Vue | null>(null)
  // Vue à retrouver en quittant les réglages ou la préparation.
  const retour = useRef<Vue>('accueil')
  const [profil, setProfil] = useState<Profil | null>(null)
  const [nomFichier, setNomFichier] = useState<string | null>(() => localStorage.getItem(CLE_NOM_FICHIER))
  const [annonce, setAnnonce] = useState<AnnonceLue | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [exporte, setExporte] = useState<string | null>(null)
  const [erreurCreation, setErreurCreation] = useState<DescriptionErreur | null>(null)
  const [miseEnPage, setMiseEnPage] = useState(false)
  const [estimation, setEstimation] = useState(() => lireEstimation(localStorage))
  const [moteur, setMoteur] = useState<{ pret: boolean; enLigne: boolean }>({ pret: true, enLigne: false })

  const verifierMoteur = useCallback(
    () =>
      Promise.all([window.api.lireParametres(), window.api.lireEtatModeles()]).then(
        ([p, m]) => {
          const etat = { pret: moteurPret(p, m.modeles), enLigne: p.fournisseur === 'api' }
          setMoteur(etat)
          return etat
        },
        () => ({ pret: true, enLigne: false }),
      ),
    [],
  )

  useEffect(() => {
    void verifierMoteur()
    window.api.obtenirProfil().then(
      (existant) => {
        if (existant) setProfil(existant.profil)
        setVue(vueInitiale(existant !== null))
      },
      () => setVue('accueil'),
    )
  }, [verifierMoteur])

  const aller = useCallback((suivante: Vue) => {
    setVue((actuelle) => {
      if ((suivante === 'reglages' || suivante === 'preparation') && actuelle && actuelle !== suivante) {
        if (actuelle !== 'reglages' && actuelle !== 'preparation') retour.current = actuelle
      }
      return suivante
    })
    window.scrollTo({ top: 0 })
  }, [])

  const preparer = useCallback(() => aller('preparation'), [aller])

  const surProfil = (nouveau: Profil, fichier?: string) => {
    setProfil(nouveau)
    if (fichier) {
      setNomFichier(fichier)
      localStorage.setItem(CLE_NOM_FICHIER, fichier)
    }
  }

  const creer = async () => {
    if (!annonce || !profil) return
    const { offre } = annonce
    const debut = Date.now()
    setErreurCreation(null)
    setMiseEnPage(false)
    aller('creation')
    try {
      const genere = await window.api.adapterCv(offre)
      enregistrerDuree(localStorage, (Date.now() - debut) / 1000)
      setEstimation(lireEstimation(localStorage))
      // Dernière étape annoncée : on prépare l'aperçu avant de montrer le résultat.
      setMiseEnPage(true)
      const { modeleCv } = await window.api.lireParametres()
      const points = genere.cv.experiences.map((e) => e.points)
      await window.api
        .htmlModeleCv(composerCv(profil, genere.cv, choixInitial(genere.cv), points), modeleCv)
        .catch(() => '')
      setResultat({ profil, offre, genere })
      setExporte(null)
      aller('resultat')
    } catch (e) {
      // Annulée : retour à l'annonce, sans message. Interrompue : l'annonce est gardée, on peut relancer.
      if (!estAnnulation(e)) setErreurCreation(decrireErreur('creation', e))
      aller('annonce')
    }
  }

  const autreOffre = () => {
    setAnnonce(null)
    setResultat(null)
    setExporte(null)
    setErreurCreation(null)
    aller('annonce')
  }

  const surDonneesEffacees = useCallback(() => {
    setProfil(null)
    setNomFichier(null)
    localStorage.removeItem(CLE_NOM_FICHIER)
    setAnnonce(null)
    setResultat(null)
    setExporte(null)
    retour.current = 'accueil'
    aller('accueil')
  }, [aller])

  const surReglagesChanges = useCallback(() => void verifierMoteur(), [verifierMoteur])

  const surPret = useCallback(() => {
    void verifierMoteur()
    aller(retour.current === 'accueil' ? 'cv' : retour.current)
  }, [aller, verifierMoteur])

  if (vue === null) return <div className="min-h-screen bg-papier" />

  const entete = enteteDeVue(vue)
  const faites = etapesFaites({
    profilPresent: profil !== null,
    annonceConfirmee: resultat !== null || vue === 'creation',
    exporte: exporte !== null,
  })
  const allerEtape = (etape: NumeroEtape) => aller(vueDeEtape(etape))
  // Rien ne peut être lu ni créé sans moteur : on le dit là où on en a besoin, avec l'action pour y remédier.
  const moteurManquant = !moteur.pret && (vue === 'cv' || vue === 'annonce')

  return (
    <div className="flex min-h-screen flex-col bg-papier text-encre">
      <header className="sticky top-0 z-20 border-b border-trait bg-surface">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-8 px-6">
          <span className="flex shrink-0 items-center gap-3 font-titre text-2xl font-bold text-encre">
            <img src={logo} alt="" width={40} height={40} className="rounded-champ" />
            Re:CV
          </span>
          {entete.etapes ? (
            <Etapes
              courante={etapeDeVue(vue)}
              faites={faites}
              onAller={allerEtape}
              etatCourante={vue === 'creation' ? 'en préparation' : 'en cours'}
              verrouille={vue === 'creation'}
              accessibles={resultat && !exporte ? [3] : []}
              etats={resultat && !exporte ? { 3: 'à télécharger' } : {}}
            />
          ) : (
            <span className="flex-1" />
          )}
          {vue === 'reglages' && (
            <BoutonLien icone="fleche-gauche" onClick={() => aller(retour.current)}>
              Revenir où j’en étais
            </BoutonLien>
          )}
          {entete.reglages && (
            <button
              type="button"
              onClick={() => aller('reglages')}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-bouton px-2 text-intro text-encre hover:text-marque"
            >
              <Icone nom="reglages" taille={22} />
              Réglages
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {moteurManquant && (
          <div className="mx-auto w-full max-w-4xl px-6 pt-8">
            <Alerte
              type="avertissement"
              titre="Re:CV n’est pas encore tout à fait prêt"
              actions={
                <Bouton taille="petit" onClick={preparer}>
                  Terminer la préparation
                </Bouton>
              }
            >
              Il manque un téléchargement unique. Ensuite, plus besoin d’internet.
            </Alerte>
          </div>
        )}

        {vue === 'accueil' && (
          <EcranAccueil
            enLigne={moteur.enLigne}
            onCommencer={() => {
              retour.current = 'accueil'
              void verifierMoteur().then((etat) => aller(apresCommencer(etat.pret)))
            }}
          />
        )}
        {vue === 'preparation' && (
          <EcranPreparation
            onPret={surPret}
            onPlusTard={() => aller(retour.current === 'accueil' ? 'cv' : retour.current)}
            onReglages={() => aller('reglages')}
          />
        )}
        {vue === 'cv' && (
          <EcranMonCv
            profil={profil}
            nomFichier={nomFichier}
            enLigne={moteur.enLigne}
            onProfil={surProfil}
            onSuivant={() => aller('annonce')}
            onPreparer={preparer}
          />
        )}
        {vue === 'annonce' &&
          (profil ? (
            <EcranAnnonce
              annonce={annonce}
              onAnnonce={(a) => {
                setAnnonce(a)
                setErreurCreation(null)
              }}
              estimationS={estimation}
              erreurCreation={erreurCreation}
              onCreer={() => void creer()}
              onRetourCv={() => aller('cv')}
              onPreparer={preparer}
            />
          ) : (
            <div className="mx-auto w-full max-w-3xl px-6 py-12">
              <EtatVide
                titre="Commençons par votre CV"
                texte="Pour lire une annonce et y adapter votre CV, il nous faut d’abord votre CV actuel."
                action={<Bouton onClick={() => aller('cv')}>Importer mon CV</Bouton>}
              />
            </div>
          ))}
        {vue === 'creation' && annonce && (
          <EcranCreation
            titrePoste={titreSansMention(annonce.offre.titrePoste)}
            annonceLue
            miseEnPage={miseEnPage}
            estimationS={estimation}
            enLigne={moteur.enLigne}
            onAnnuler={() => void window.api.annulerAdaptation()}
          />
        )}
        {/* Gardé monté tant qu'un CV existe : les ajustements ne sont pas perdus en passant par un autre écran. */}
        {resultat && (
          <div className={vue === 'resultat' ? 'flex flex-1 flex-col' : 'hidden'}>
            <EcranNouveauCv
              key={resultat.genere.id}
              profil={resultat.profil}
              adapte={resultat.genere.cv}
              onExporte={(chemin) => {
                setExporte(chemin)
                aller('succes')
              }}
            />
          </div>
        )}
        {vue === 'resultat' && !resultat && (
          <div className="mx-auto w-full max-w-3xl px-6 py-12">
            <EtatVide
              titre="Votre nouveau CV apparaîtra ici"
              texte="Pour le créer, il nous faut votre CV actuel et l’annonce qui vous intéresse."
              action={
                <Bouton onClick={() => aller(profil ? 'annonce' : 'cv')}>
                  {profil ? 'Indiquer une annonce' : 'Commencer par mon CV'}
                </Bouton>
              }
            />
          </div>
        )}
        {vue === 'succes' && exporte && resultat && (
          <EcranSucces
            chemin={exporte}
            titrePoste={titreSansMention(resultat.offre.titrePoste)}
            onAutreOffre={autreOffre}
          />
        )}
        {vue === 'reglages' && <EcranReglages onChange={surReglagesChanges} onEfface={surDonneesEffacees} />}
      </main>
    </div>
  )
}
