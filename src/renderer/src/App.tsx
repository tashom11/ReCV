import type { GeneratedCv } from '@core/api'
import type { JobPosting, Profile } from '@core/schemas'
import { isLocalService } from '@core/serviceUrl'
import { composeCv, initialChoices } from '@core/tailoring/composition'
import { useCallback, useEffect, useRef, useState } from 'react'
import { focusScreenTitle, windowTitle } from './accessibility'
import logo from './assets/logo.png'
import { EcranAccueil } from './ecrans/Accueil'
import { type AnnonceLue, EcranAnnonce } from './ecrans/Annonce'
import { EcranCreation } from './ecrans/Creation'
import { useMiseAJour } from './ecrans/MisesAJour'
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
  profil: Profile
  offre: JobPosting
  genere: GeneratedCv
}

const CLE_NOM_FICHIER = 'recv.nomFichierCv'

export default function App() {
  const [vue, setVue] = useState<Vue | null>(null)
  // Vue à retrouver en quittant les réglages ou la préparation.
  const retour = useRef<Vue>('accueil')
  const [profil, setProfil] = useState<Profile | null>(null)
  const [nomFichier, setNomFichier] = useState<string | null>(() => localStorage.getItem(CLE_NOM_FICHIER))
  const [annonce, setAnnonce] = useState<AnnonceLue | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const [exporte, setExporte] = useState<string | null>(null)
  const [erreurCreation, setErreurCreation] = useState<DescriptionErreur | null>(null)
  const [miseEnPage, setMiseEnPage] = useState(false)
  const [estimation, setEstimation] = useState(() => lireEstimation(localStorage))
  const [moteur, setMoteur] = useState<{ pret: boolean; enLigne: boolean }>({ pret: true, enLigne: false })

  const miseAJour = useMiseAJour()

  const verifierMoteur = useCallback(
    () =>
      Promise.all([window.api.getSettings(), window.api.getModelsState()]).then(
        ([p, m]) => {
          // "Online": the CV leaves this computer (online service, or Ollama on another machine).
          const enLigne = p.provider === 'api' || (p.provider === 'ollama' && !isLocalService(p.ollamaUrl))
          const etat = { pret: moteurPret(p, m.models), enLigne }
          setMoteur(etat)
          return etat
        },
        () => ({ pret: true, enLigne: false }),
      ),
    [],
  )

  useEffect(() => {
    void verifierMoteur()
    window.api.getProfile().then(
      (existant) => {
        if (existant) setProfil(existant.profile)
        setVue(vueInitiale(existant !== null))
      },
      () => setVue('accueil'),
    )
  }, [verifierMoteur])

  // Each screen change is announced: window title, then focus on the title of the new screen
  // (the clicked button has disappeared, the focus would otherwise fall back to the page).
  const previousView = useRef<Vue | null>(null)
  useEffect(() => {
    if (vue === null) return
    document.title = windowTitle(vue)
    const isFirstScreen = previousView.current === null
    previousView.current = vue
    // Effects run after the DOM is updated: the new title is already there. (No requestAnimationFrame: it is
    // paused while the window is minimised, which users are invited to do during long tasks.)
    if (!isFirstScreen) focusScreenTitle()
  }, [vue])

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

  const surProfil = (nouveau: Profile, fichier?: string) => {
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
      const genere = await window.api.tailorCv(offre)
      enregistrerDuree(localStorage, (Date.now() - debut) / 1000)
      setEstimation(lireEstimation(localStorage))
      // Dernière étape annoncée : on prépare l'aperçu avant de montrer le résultat.
      setMiseEnPage(true)
      const { cvTemplate: modeleCv } = await window.api.getSettings()
      const points = genere.cv.experiences.map((e) => e.bullets)
      await window.api
        .templateHtml(composeCv(profil, genere.cv, initialChoices(genere.cv), points), modeleCv)
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
          {/* Une version téléchargée se signale partout où les réglages sont accessibles. */}
          {entete.reglages && miseAJour?.status === 'prete' && (
            <button
              type="button"
              onClick={() => aller('reglages')}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-accent bg-accent-pale px-4 font-bold text-encre hover:brightness-95"
            >
              <Icone nom="telecharger" taille={18} />
              Mise à jour prête
            </button>
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

      <main className="ecrans flex flex-1 flex-col">
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
            titrePoste={titreSansMention(annonce.offre.jobTitle)}
            annonceLue
            miseEnPage={miseEnPage}
            estimationS={estimation}
            enLigne={moteur.enLigne}
            onAnnuler={() => void window.api.cancelTailoring()}
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
            titrePoste={titreSansMention(resultat.offre.jobTitle)}
            onAutreOffre={autreOffre}
          />
        )}
        {vue === 'reglages' && <EcranReglages onChange={surReglagesChanges} onEfface={surDonneesEffacees} />}
      </main>
    </div>
  )
}
