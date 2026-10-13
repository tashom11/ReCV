import type { EtatParametres, Parametres } from '@core/api'
import { useCallback, useEffect, useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'
import { GestionModeles } from './GestionModeles'

const FOURNISSEURS: { valeur: Parametres['fournisseur']; nom: string; detail: string }[] = [
  {
    valeur: 'ollama',
    nom: 'Ollama (local)',
    detail: 'Ollama installé sur ton ordinateur : tes données restent chez toi.',
  },
  {
    valeur: 'local',
    nom: 'Modèle embarqué',
    detail: 'Fichier GGUF exécuté dans l’application : tes données restent chez toi.',
  },
  {
    valeur: 'api',
    nom: 'API en ligne (clé personnelle)',
    detail: 'OpenAI, Mistral, OpenRouter… Ton CV est envoyé à ce service.',
  },
]

export function EcranParametres() {
  const [etat, setEtat] = useState<EtatParametres | null>(null)
  const [cle, setCle] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Action en cours (identifiant du bouton) : sert à afficher la pastille animée sur le bon bouton. */
  const [occupe, setOccupe] = useState<string | null>(null)

  useEffect(() => {
    window.api.lireParametres().then(setEtat, (e) => setErreur(messageErreur(e)))
  }, [])

  // Un modèle vient d'être installé : le process principal l'a sélectionné, on ne reprend que ce champ.
  const surModeleInstalle = useCallback(() => {
    window.api.lireParametres().then((p) => setEtat((e) => (e ? { ...e, cheminModeleLocal: p.cheminModeleLocal } : e)))
  }, [])

  if (!etat)
    return erreur ? <Alerte type="erreur">{erreur}</Alerte> : <p className="text-sm text-slate-500">Chargement…</p>

  const maj = (partiel: Partial<Parametres>) => setEtat({ ...etat, ...partiel })

  const executer = async (
    id: string,
    action: () => Promise<EtatParametres>,
    confirmation: string | ((etat: EtatParametres) => string),
  ) => {
    setErreur(null)
    setMessage(null)
    setOccupe(id)
    try {
      const resultat = await action()
      setEtat(resultat)
      setMessage(typeof confirmation === 'function' ? confirmation(resultat) : confirmation)
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(null)
    }
  }

  const enregistrer = () => {
    const { cleApiDefinie: _ignore, ...parametres } = etat
    const avaitUneCle = etat.cleApiDefinie
    return executer(
      'enregistrer',
      () => window.api.enregistrerParametres(parametres),
      (apres) =>
        avaitUneCle && !apres.cleApiDefinie
          ? 'Paramètres enregistrés. L’adresse de l’API a changé : la clé a été supprimée par sécurité, saisis-la à nouveau.'
          : 'Paramètres enregistrés.',
    )
  }

  return (
    <div className="space-y-5">
      <Titre sousTitre="Choisis où tourne le modèle de langage qui analyse ton CV et les offres.">Paramètres</Titre>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {message && <Alerte type="succes">{message}</Alerte>}

      <Carte titre="Fournisseur">
        <div className="space-y-2">
          {FOURNISSEURS.map((f) => (
            <label
              key={f.valeur}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3"
            >
              <input
                type="radio"
                name="fournisseur"
                className="mt-1"
                checked={etat.fournisseur === f.valeur}
                onChange={() => maj({ fournisseur: f.valeur })}
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{f.nom}</span>
                <span className="block text-xs text-slate-600">{f.detail}</span>
              </span>
            </label>
          ))}
        </div>

        {etat.fournisseur === 'api' && (
          <Alerte type="avertissement">
            <strong>Données personnelles :</strong> ton CV (nom, e-mail, téléphone, parcours) sera transmis à ce service
            en ligne. Les offres gratuites ou d’essai peuvent utiliser les données envoyées pour entraîner leurs modèles
            : vérifie leurs conditions, ou préfère Ollama / le modèle embarqué.
          </Alerte>
        )}

        {etat.fournisseur === 'ollama' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ etiquette="Adresse d’Ollama" valeur={etat.urlOllama} onChange={(v) => maj({ urlOllama: v })} />
            <Champ etiquette="Modèle" valeur={etat.modeleOllama} onChange={(v) => maj({ modeleOllama: v })} />
          </div>
        )}

        {etat.fournisseur === 'local' && (
          <Champ
            etiquette="Chemin du fichier modèle (.gguf)"
            valeur={etat.cheminModeleLocal ?? ''}
            onChange={(v) => maj({ cheminModeleLocal: v })}
          />
        )}

        {etat.fournisseur === 'api' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              etiquette="URL de l’API (compatible OpenAI)"
              valeur={etat.urlApi}
              onChange={(v) => maj({ urlApi: v })}
            />
            <Champ etiquette="Modèle" valeur={etat.modeleApi} onChange={(v) => maj({ modeleApi: v })} />
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={etat.reformulerPuces}
            onChange={(e) => maj({ reformulerPuces: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Reformuler les puces avec le modèle (plus lent)
            </span>
            <span className="block text-xs text-slate-600">
              Désactivé : Re:CV sélectionne dans tes expériences les puces les plus proches de l’offre, sans les
              réécrire (instantané, rien n’est inventé). Activé : le modèle les reformule, ce qui ajoute plusieurs
              minutes avec un modèle local.
            </span>
          </span>
        </label>

        <Bouton onClick={enregistrer} enCours={occupe === 'enregistrer'} desactive={occupe !== null}>
          {occupe === 'enregistrer' ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </Carte>

      {etat.fournisseur === 'local' && <GestionModeles onChange={surModeleInstalle} />}

      {etat.fournisseur === 'api' && (
        <Carte titre="Clé API">
          <p className="text-xs text-slate-600">
            {etat.cleApiDefinie
              ? 'Une clé est enregistrée (chiffrée sur ton ordinateur). Elle n’est jamais réaffichée.'
              : 'Aucune clé enregistrée.'}
          </p>
          <Champ etiquette="Nouvelle clé" type="password" valeur={cle} onChange={setCle} />
          <div className="flex gap-3">
            <Bouton
              desactive={!cle.trim() || occupe !== null}
              enCours={occupe === 'cle'}
              onClick={async () => {
                await executer('cle', () => window.api.definirCleApi(cle.trim()), 'Clé enregistrée.')
                setCle('')
              }}
            >
              {occupe === 'cle' ? 'Chiffrement…' : 'Enregistrer la clé'}
            </Bouton>
            <Bouton
              variante="danger"
              desactive={!etat.cleApiDefinie || occupe !== null}
              enCours={occupe === 'cle-suppression'}
              onClick={() => executer('cle-suppression', () => window.api.definirCleApi(''), 'Clé supprimée.')}
            >
              Supprimer la clé
            </Bouton>
          </div>
        </Carte>
      )}

      <Carte titre="Mes données">
        <p className="text-xs text-slate-600">
          Profil, offres, CV générés et clé API sont stockés uniquement sur cet ordinateur. Tu peux tout effacer ; les
          paramètres et les modèles téléchargés sont conservés.
        </p>
        <Bouton
          variante="danger"
          enCours={occupe === 'effacer'}
          desactive={occupe !== null}
          onClick={() => {
            if (!window.confirm('Effacer définitivement ton profil, tes offres, tes CV générés et ta clé API ?')) return
            executer(
              'effacer',
              async () => {
                await window.api.effacerDonnees()
                return window.api.lireParametres()
              },
              'Toutes tes données ont été effacées. Recharge l’application pour repartir de zéro.',
            )
          }}
        >
          {occupe === 'effacer' ? 'Effacement…' : 'Effacer toutes mes données'}
        </Bouton>
      </Carte>
    </div>
  )
}
