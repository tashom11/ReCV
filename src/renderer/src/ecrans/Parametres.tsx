import type { EtatParametres, Parametres } from '@core/api'
import { useEffect, useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'

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

  useEffect(() => {
    window.api.lireParametres().then(setEtat, (e) => setErreur(messageErreur(e)))
  }, [])

  if (!etat)
    return erreur ? <Alerte type="erreur">{erreur}</Alerte> : <p className="text-sm text-slate-500">Chargement…</p>

  const maj = (partiel: Partial<Parametres>) => setEtat({ ...etat, ...partiel })

  const executer = async (action: () => Promise<EtatParametres>, confirmation: string) => {
    setErreur(null)
    setMessage(null)
    try {
      setEtat(await action())
      setMessage(confirmation)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const enregistrer = () => {
    const { cleApiDefinie: _ignore, ...parametres } = etat
    return executer(() => window.api.enregistrerParametres(parametres), 'Paramètres enregistrés.')
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

        <Bouton onClick={enregistrer}>Enregistrer</Bouton>
      </Carte>

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
              desactive={!cle.trim()}
              onClick={async () => {
                await executer(() => window.api.definirCleApi(cle.trim()), 'Clé enregistrée.')
                setCle('')
              }}
            >
              Enregistrer la clé
            </Bouton>
            <Bouton
              variante="danger"
              desactive={!etat.cleApiDefinie}
              onClick={() => executer(() => window.api.definirCleApi(''), 'Clé supprimée.')}
            >
              Supprimer la clé
            </Bouton>
          </div>
        </Carte>
      )}
    </div>
  )
}
