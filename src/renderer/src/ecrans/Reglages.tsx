import type { EtatModeles, EtatParametres, ModeleEmbarqueEtat, Parametres, ProgressionModele } from '@core/api'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { type DescriptionErreur, decrireErreur, messageErreur } from '../erreurs'
import { formaterTaille } from '../estimation'
import {
  Alerte,
  AlerteErreur,
  Bouton,
  Carte,
  CaseACocher,
  Champ,
  Confirmation,
  Icone,
  Pastille,
  Selection,
  Titre,
} from '../ui'

// Les trois modèles embarqués, nommés par ce qu'ils changent pour l'utilisateur.
const NIVEAUX: Record<string, { nom: string; detail: string }> = {
  'qwen3.5-2b': { nom: 'Rapide', detail: 'Pour les ordinateurs modestes' },
  'qwen3.5-4b': { nom: 'Équilibré', detail: 'Bon résultat sur la plupart des ordinateurs' },
  'qwen3.5-9b': { nom: 'Soigné', detail: 'Meilleur résultat' },
}

const SERVICES = [
  { valeur: 'https://api.openai.com/v1', libelle: 'OpenAI' },
  { valeur: 'https://api.mistral.ai/v1', libelle: 'Mistral' },
  { valeur: 'https://openrouter.ai/api/v1', libelle: 'OpenRouter' },
]
const AUTRE_SERVICE = 'autre'

/** Carte à cocher (bouton radio) : tout le bloc est cliquable, le choix est entouré et nommé. */
function ChoixMoteur({
  choisi,
  onChoisir,
  titre,
  etiquette,
  description,
  misEnAvant = false,
  children,
}: {
  choisi: boolean
  onChoisir: () => void
  titre: string
  etiquette?: ReactNode
  description: string
  misEnAvant?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={`rounded-carte ${
        choisi
          ? `border-2 border-marque ${misEnAvant ? 'bg-marque-pale' : 'bg-surface'}`
          : 'border border-trait bg-surface p-px'
      }`}
    >
      <label className="flex min-h-11 items-start gap-3.5 p-4">
        <input type="radio" name="moteur" className="mt-1 size-5 shrink-0" checked={choisi} onChange={onChoisir} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2.5 text-intro font-bold text-encre">
            {titre}
            {etiquette}
          </span>
          <span className="block text-corps text-encre-douce">{description}</span>
        </span>
      </label>
      {children && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  )
}

/** Choix et installation du modèle qui tourne sur l'ordinateur : Rapide, Équilibré ou Soigné. */
function NiveauxModele({
  cheminActif,
  onActif,
  onEtat,
}: {
  cheminActif: string | undefined
  /** Un modèle installé est choisi, ou vient d'être installé. */
  onActif: (chemin: string | undefined) => void
  onEtat: (etat: EtatModeles) => void
}) {
  const [etat, setEtat] = useState<EtatModeles | null>(null)
  const [progression, setProgression] = useState<ProgressionModele | null>(null)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  const [occupe, setOccupe] = useState<string | null>(null)

  const rafraichir = useCallback(
    () =>
      window.api.lireEtatModeles().then(
        (e) => {
          setEtat(e)
          setProgression(e.telechargement)
          onEtat(e)
          return e
        },
        () => null,
      ),
    [onEtat],
  )

  useEffect(() => {
    void rafraichir()
    return window.api.surProgressionModele((p) => {
      setProgression(p)
      if (p.etat === 'termine') {
        // Le process principal a sélectionné le modèle installé : on reprend ce choix.
        void rafraichir().then((e) => onActif(e?.modeles.find((m) => m.id === p.id)?.chemin))
      }
      if (p.etat === 'annule' || p.etat === 'erreur') void rafraichir()
    })
  }, [rafraichir, onActif])

  const enCours = progression?.etat === 'en-cours' || progression?.etat === 'verification'

  const installer = async (id: string) => {
    setErreur(null)
    setOccupe(id)
    try {
      await window.api.telechargerModele(id)
    } catch (e) {
      setErreur(decrireErreur('preparation', e))
    } finally {
      setOccupe(null)
    }
  }

  const supprimer = async (m: ModeleEmbarqueEtat) => {
    setErreur(null)
    setOccupe(m.id)
    try {
      await window.api.supprimerModele(m.id)
      const apres = await rafraichir()
      if (cheminActif === m.chemin) onActif(apres?.modeles.find((x) => x.installe)?.chemin)
    } catch (e) {
      setErreur(decrireErreur('reglages', e))
    } finally {
      setOccupe(null)
    }
  }

  if (!etat) return null

  return (
    <fieldset className="space-y-2.5">
      <legend className="pb-2 text-corps font-bold text-encre">Rapidité ou soin du résultat</legend>
      {erreur && (
        <AlerteErreur description={erreur} surAction={() => setErreur(null)} libelles={{ reprendre: 'Compris' }} />
      )}
      {etat.modeles.map((m) => {
        const niveau = NIVEAUX[m.id] ?? { nom: m.nom, detail: m.description }
        const actif = m.installe && cheminActif === m.chemin
        const telechargement = progression?.id === m.id && enCours ? progression : null
        const pourcentage =
          telechargement && telechargement.totalOctets > 0
            ? Math.round((telechargement.recuOctets / telechargement.totalOctets) * 100)
            : 0
        const lent = m.compatible ? '' : ', mais lent sur votre ordinateur'
        return (
          <div
            key={m.id}
            className={`space-y-3 rounded-carte bg-surface p-4 ${actif ? 'border-2 border-marque' : 'border border-trait p-[17px]'}`}
          >
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex min-h-11 min-w-0 flex-1 items-start gap-3.5">
                <input
                  type="radio"
                  name="niveau-modele"
                  className="mt-1 size-5 shrink-0"
                  checked={actif}
                  disabled={!m.installe}
                  onChange={() => onActif(m.chemin)}
                />
                <span className="min-w-0">
                  <span className="block text-corps text-encre">
                    <strong>{niveau.nom}</strong>
                    {m.recommande && <span className="text-marque"> · conseillé pour votre ordinateur</span>}
                  </span>
                  <span className="block text-petit text-aide">
                    {m.installe
                      ? `Installé · ${formaterTaille(m.tailleOctets)}`
                      : `${niveau.detail}${lent} · ${formaterTaille(m.tailleOctets)} à télécharger`}
                  </span>
                </span>
              </label>
              {m.installe ? (
                <Bouton
                  variante="danger"
                  taille="petit"
                  desactive={enCours || occupe !== null}
                  enCours={occupe === m.id}
                  onClick={() => void supprimer(m)}
                >
                  Supprimer
                </Bouton>
              ) : telechargement ? (
                <Bouton variante="secondaire" taille="petit" onClick={() => void window.api.annulerTelechargement()}>
                  Mettre en pause
                </Bouton>
              ) : (
                <Bouton
                  variante="secondaire"
                  taille="petit"
                  desactive={enCours || occupe !== null}
                  enCours={occupe === m.id}
                  onClick={() => void installer(m.id)}
                >
                  Installer
                </Bouton>
              )}
            </div>
            {telechargement && (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-label={`Téléchargement du niveau ${niveau.nom}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pourcentage}
                  className="h-2.5 overflow-hidden rounded-full bg-creux"
                >
                  {telechargement.etat === 'verification' ? (
                    <div className="barre-indeterminee h-full w-1/4 rounded-full bg-marque" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-marque transition-all"
                      style={{ width: `${pourcentage}%` }}
                    />
                  )}
                </div>
                <p role="status" className="text-petit text-aide">
                  {telechargement.etat === 'verification'
                    ? 'Vérification du fichier… quelques secondes'
                    : `${formaterTaille(telechargement.recuOctets)} sur ${formaterTaille(telechargement.totalOctets)} (${pourcentage} %)`}
                </p>
              </div>
            )}
            {progression?.id === m.id && progression.etat === 'annule' && (
              <p className="text-petit text-aide">En pause : le téléchargement reprendra là où il s’était arrêté.</p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}

/** Réglages, hors du parcours : le moteur recommandé est déjà choisi, le reste est replié dans les options avancées. */
export function EcranReglages({
  onChange,
  onEfface,
}: {
  /** Les réglages ou les modèles installés ont changé. */
  onChange: () => void
  /** Toutes les données ont été effacées. */
  onEfface: () => void
}) {
  const [etat, setEtat] = useState<EtatParametres | null>(null)
  const [modeles, setModeles] = useState<EtatModeles | null>(null)
  const [cle, setCle] = useState('')
  const [autreService, setAutreService] = useState(false)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [occupe, setOccupe] = useState<'enregistrer' | 'cle' | 'effacer' | null>(null)
  const [effacement, setEffacement] = useState(false)

  useEffect(() => {
    window.api.lireParametres().then(
      (p) => {
        setEtat(p)
        setAutreService(!SERVICES.some((s) => s.valeur === p.urlApi))
      },
      (e) => setErreur(decrireErreur('reglages', e)),
    )
  }, [])

  // Confirmation brève : elle s'efface d'elle-même.
  useEffect(() => {
    if (!confirmation) return
    const minuteur = setTimeout(() => setConfirmation(null), 5000)
    return () => clearTimeout(minuteur)
  }, [confirmation])

  const surEtatModeles = useCallback(
    (e: EtatModeles) => {
      setModeles(e)
      onChange()
    },
    [onChange],
  )
  const surModeleActif = useCallback((chemin: string | undefined) => {
    setEtat((e) => (e ? { ...e, cheminModeleLocal: chemin } : e))
  }, [])

  if (!etat) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {erreur ? <AlerteErreur description={erreur} surAction={() => undefined} /> : <p role="status">Un instant…</p>}
      </div>
    )
  }

  const maj = (partiel: Partial<Parametres>) => setEtat({ ...etat, ...partiel })
  const local = etat.fournisseur === 'local'
  const pret = local && (Boolean(etat.cheminModeleLocal) || Boolean(modeles?.modeles.some((m) => m.installe)))

  const enregistrer = async () => {
    setErreur(null)
    setConfirmation(null)
    setOccupe('enregistrer')
    try {
      const { cleApiDefinie: _ignore, ...parametres } = etat
      // Les réglages d'abord : changer de service efface l'ancienne clé, la nouvelle est enregistrée ensuite.
      let apres = await window.api.enregistrerParametres(parametres)
      if (cle.trim()) apres = await window.api.definirCleApi(cle.trim())
      setCle('')
      setEtat(apres)
      setConfirmation(
        etat.cleApiDefinie && !apres.cleApiDefinie
          ? 'Réglages enregistrés. Le service a changé : saisissez à nouveau votre clé personnelle.'
          : 'Vos réglages sont enregistrés.',
      )
      onChange()
    } catch (e) {
      setErreur(decrireErreur('reglages', e))
    } finally {
      setOccupe(null)
    }
  }

  const supprimerCle = async () => {
    setErreur(null)
    setOccupe('cle')
    try {
      setEtat({ ...etat, cleApiDefinie: (await window.api.definirCleApi('')).cleApiDefinie })
      setConfirmation('Votre clé personnelle est supprimée.')
    } catch (e) {
      setErreur(decrireErreur('reglages', e))
    } finally {
      setOccupe(null)
    }
  }

  const toutEffacer = async () => {
    setErreur(null)
    setOccupe('effacer')
    try {
      await window.api.effacerDonnees()
      onEfface()
    } catch (e) {
      setErreur({
        ...decrireErreur('reglages', e),
        titre: 'Vos données n’ont pas pu être effacées',
        texte: messageErreur(e),
      })
      setOccupe(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <Titre sousTitre="La plupart des personnes n’ont rien à changer ici.">Réglages</Titre>
      {erreur && <AlerteErreur description={erreur} surAction={() => setErreur(null)} />}

      <Carte titre="Moteur d’intelligence artificielle" sousTitre="C’est lui qui lit votre CV et l’annonce.">
        <ChoixMoteur
          choisi={local}
          onChoisir={() => maj({ fournisseur: 'local' })}
          titre="Sur mon ordinateur"
          etiquette={<Pastille variante="recommande">Recommandé</Pastille>}
          description="Gratuit et privé : rien ne quitte votre ordinateur. Fonctionne sans internet."
          misEnAvant
        >
          {local && (
            <p className={`flex items-center gap-2 pl-[34px] font-bold ${pret ? 'text-marque' : 'text-alerte'}`}>
              <Icone nom={pret ? 'coche-cercle' : 'alerte'} taille={18} />
              {pret ? 'Prêt à l’emploi' : 'Il manque un téléchargement : installez un niveau ci-dessous'}
            </p>
          )}
        </ChoixMoteur>

        <NiveauxModele cheminActif={etat.cheminModeleLocal} onActif={surModeleActif} onEtat={surEtatModeles} />

        <details open={!local} className="group rounded-carte border border-trait bg-papier">
          <summary className="flex min-h-16 items-center gap-4 rounded-carte px-5 py-3">
            <span className="flex-1">
              <span className="block font-titre text-intro font-bold">Options avancées</span>
              <span className="block text-petit text-aide">Pour les personnes à l’aise avec l’informatique</span>
            </span>
            <Icone nom="chevron-bas" className="transition-transform duration-(--duree) group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-5 pb-5">
            <ChoixMoteur
              choisi={etat.fournisseur === 'ollama'}
              onChoisir={() => maj({ fournisseur: 'ollama' })}
              titre="Ollama (installé séparément)"
              description="Utilise un modèle servi par Ollama sur cet ordinateur. Les données restent chez vous."
            >
              {etat.fournisseur === 'ollama' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Champ etiquette="Adresse d’Ollama" valeur={etat.urlOllama} onChange={(v) => maj({ urlOllama: v })} />
                  <Champ etiquette="Modèle" valeur={etat.modeleOllama} onChange={(v) => maj({ modeleOllama: v })} />
                </div>
              )}
            </ChoixMoteur>

            <ChoixMoteur
              choisi={etat.fournisseur === 'api'}
              onChoisir={() => maj({ fournisseur: 'api' })}
              titre="Service en ligne avec ma clé personnelle"
              description="OpenAI, Mistral, OpenRouter… Rapide, mais payant selon le service."
            >
              {etat.fournisseur === 'api' && (
                <>
                  <Alerte type="avertissement">
                    <strong>Votre CV et l’annonce seront envoyés à ce service.</strong> Ils quittent votre ordinateur à
                    chaque création de CV.
                  </Alerte>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Selection
                      etiquette="Service"
                      valeur={autreService ? AUTRE_SERVICE : etat.urlApi}
                      options={[...SERVICES, { valeur: AUTRE_SERVICE, libelle: 'Autre adresse' }]}
                      onChange={(v) => {
                        setAutreService(v === AUTRE_SERVICE)
                        if (v !== AUTRE_SERVICE) maj({ urlApi: v })
                      }}
                    />
                    <Champ
                      etiquette="Clé personnelle (API)"
                      type="password"
                      valeur={cle}
                      onChange={setCle}
                      placeholder={etat.cleApiDefinie ? '•••••••••••• (enregistrée)' : ''}
                    />
                    {autreService && (
                      <Champ
                        etiquette="Adresse du service"
                        valeur={etat.urlApi}
                        onChange={(v) => maj({ urlApi: v })}
                        aide="Elle commence par https:// et finit souvent par /v1."
                      />
                    )}
                    <Champ
                      etiquette="Modèle"
                      valeur={etat.modeleApi}
                      onChange={(v) => maj({ modeleApi: v })}
                      aide="Le nom donné par le service, par exemple « mistral-small-latest »."
                    />
                  </div>
                  <p className="text-petit text-aide">
                    {etat.cleApiDefinie
                      ? 'Une clé est enregistrée, chiffrée sur votre ordinateur. Elle n’est jamais réaffichée.'
                      : 'Aucune clé enregistrée pour l’instant.'}
                  </p>
                  {etat.cleApiDefinie && (
                    <Bouton
                      variante="danger"
                      taille="petit"
                      onClick={() => void supprimerCle()}
                      enCours={occupe === 'cle'}
                      desactive={occupe !== null}
                    >
                      Supprimer la clé
                    </Bouton>
                  )}
                </>
              )}
            </ChoixMoteur>

            <div className="rounded-carte border border-trait bg-surface px-4 py-2">
              <CaseACocher
                etiquette={<strong className="text-intro">Réécrire les phrases de mes expériences</strong>}
                aide="Désactivé : Re:CV choisit vos phrases les plus proches de l’annonce, sans les modifier. Activé : il les reformule, ce qui ajoute plusieurs minutes."
                coche={etat.reformulerPuces}
                onChange={(v) => maj({ reformulerPuces: v })}
              />
            </div>

            <Champ
              etiquette="Fichier du modèle (.gguf)"
              valeur={etat.cheminModeleLocal ?? ''}
              onChange={(v) => maj({ cheminModeleLocal: v })}
            />
          </div>
        </details>
      </Carte>

      <Carte
        titre="Mes données"
        sousTitre="Votre CV, vos annonces et les CV créés sont enregistrés uniquement sur cet ordinateur."
      >
        {effacement ? (
          <div
            role="alertdialog"
            aria-labelledby="titre-effacement"
            className="space-y-3 rounded-carte border-2 border-erreur bg-erreur-fond p-5"
          >
            <h3 id="titre-effacement" className="font-titre text-intro font-bold text-erreur">
              Tout effacer définitivement ?
            </h3>
            <p className="text-corps text-encre">
              Votre CV importé, vos annonces et vos CV créés seront supprimés de Re:CV. Les fichiers déjà téléchargés
              sur votre ordinateur ne sont pas touchés. Les réglages sont gardés
              {etat.cleApiDefinie ? ', sauf votre clé personnelle, effacée elle aussi' : ''}.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Bouton variante="danger-plein" onClick={() => void toutEffacer()} enCours={occupe === 'effacer'}>
                Oui, tout effacer
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setEffacement(false)} desactive={occupe !== null}>
                Non, garder mes données
              </Bouton>
            </div>
          </div>
        ) : (
          <Bouton variante="danger" onClick={() => setEffacement(true)}>
            Tout effacer…
          </Bouton>
        )}
      </Carte>

      {confirmation && <Confirmation>{confirmation}</Confirmation>}
      <div className="flex justify-end">
        <Bouton onClick={() => void enregistrer()} enCours={occupe === 'enregistrer'} desactive={occupe !== null}>
          Enregistrer les réglages
        </Bouton>
      </div>
    </div>
  )
}
