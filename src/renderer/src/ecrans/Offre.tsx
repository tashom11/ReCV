import type { CvGenere } from '@core/api'
import type { Offre } from '@core/schemas'
import { useState } from 'react'
import { useProgressionTache } from '../progression'
import { Alerte, Bouton, Carte, Champ, Chargement, messageErreur, Titre } from '../ui'

type Mode = 'url' | 'texte'
type Tache = 'recuperation' | 'analyse' | 'adaptation'

export function EcranOffre({
  profilPresent,
  onResultat,
}: {
  profilPresent: boolean
  onResultat: (offre: Offre, genere: CvGenere) => void
}) {
  const [mode, setMode] = useState<Mode>('url')
  const [url, setUrl] = useState('')
  const [texte, setTexte] = useState('')
  const [offre, setOffre] = useState<Offre | null>(null)
  const [occupe, setOccupe] = useState<Tache | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const progressionOffre = useProgressionTache('offre', occupe === 'analyse')
  const progressionAdaptation = useProgressionTache('adaptation', occupe === 'adaptation')

  const recuperer = async () => {
    setOccupe('recuperation')
    setErreur(null)
    try {
      setOffre(await window.api.recupererOffre(url.trim()))
    } catch (e) {
      // Échec de la récupération : on bascule sur le collage du texte, comme prévu par le message d'erreur.
      setErreur(messageErreur(e))
      setMode('texte')
    } finally {
      setOccupe(null)
    }
  }

  const analyser = async () => {
    setOccupe('analyse')
    setErreur(null)
    try {
      setOffre(await window.api.analyserTexteOffre(texte))
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(null)
    }
  }

  const adapter = async () => {
    if (!offre) return
    setOccupe('adaptation')
    setErreur(null)
    try {
      onResultat(offre, await window.api.adapterCv(offre))
    } catch (e) {
      setErreur(messageErreur(e))
    } finally {
      setOccupe(null)
    }
  }

  const majOffre = (partiel: Partial<Offre>) => setOffre((o) => (o ? { ...o, ...partiel } : o))
  const occupeAilleurs = occupe !== null

  return (
    <div className="space-y-5">
      <Titre sousTitre="Indique l’annonce à viser : lien vers l’offre, ou texte collé si le site la bloque.">
        Offre d’emploi
      </Titre>
      {!profilPresent && <Alerte type="avertissement">Importe d’abord ton CV dans l’onglet « Profil ».</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex gap-2">
          <Bouton
            variante={mode === 'url' ? 'principal' : 'secondaire'}
            desactive={occupeAilleurs}
            onClick={() => setMode('url')}
          >
            Depuis un lien
          </Bouton>
          <Bouton
            variante={mode === 'texte' ? 'principal' : 'secondaire'}
            desactive={occupeAilleurs}
            onClick={() => setMode('texte')}
          >
            Coller le texte
          </Bouton>
        </div>

        {mode === 'url' ? (
          <div className="space-y-3">
            <Champ etiquette="Adresse de l’offre" type="url" valeur={url} onChange={setUrl} placeholder="https://…" />
            <Bouton onClick={recuperer} enCours={occupe === 'recuperation'} desactive={!url.trim() || occupeAilleurs}>
              {occupe === 'recuperation' ? 'Récupération en cours…' : 'Récupérer l’offre'}
            </Bouton>
          </div>
        ) : (
          <div className="space-y-3">
            <Champ etiquette="Texte de l’offre" multiligne lignes={10} valeur={texte} onChange={setTexte} />
            <Bouton onClick={analyser} enCours={occupe === 'analyse'} desactive={!texte.trim() || occupeAilleurs}>
              {occupe === 'analyse' ? 'Analyse en cours…' : 'Analyser l’offre'}
            </Bouton>
          </div>
        )}

        {occupe === 'recuperation' && (
          <Chargement
            titre="Récupération de l’offre…"
            etape="Téléchargement de la page puis extraction du texte"
            note="Les pages qui s’affichent par script peuvent demander quelques secondes de plus."
          />
        )}
        {occupe === 'analyse' && (
          <Chargement
            titre="Analyse de l’offre par le modèle…"
            etape={progressionOffre?.etape ?? 'Lecture de l’annonce'}
            note="Le modèle repère l’intitulé du poste, l’entreprise et le lieu."
          />
        )}
      </Carte>

      {offre && (
        <Carte titre="Offre détectée (modifiable)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Champ
              etiquette="Intitulé du poste"
              valeur={offre.titrePoste}
              onChange={(v) => majOffre({ titrePoste: v })}
            />
            <Champ
              etiquette="Entreprise"
              valeur={offre.entreprise ?? ''}
              onChange={(v) => majOffre({ entreprise: v })}
            />
          </div>
          <Champ
            etiquette="Texte de l’offre"
            multiligne
            lignes={8}
            valeur={offre.texteBrut}
            onChange={(v) => majOffre({ texteBrut: v })}
          />
          <Bouton onClick={adapter} enCours={occupe === 'adaptation'} desactive={!profilPresent || occupeAilleurs}>
            {occupe === 'adaptation' ? 'Adaptation en cours…' : 'Adapter mon CV'}
          </Bouton>
          {occupe === 'adaptation' && (
            <Chargement
              titre="Adaptation de ton CV en cours…"
              etape={progressionAdaptation?.etape ?? 'Préparation du modèle'}
              courant={progressionAdaptation?.courant}
              total={progressionAdaptation?.total}
              calcul={progressionAdaptation?.calcul}
              note="Avec un modèle local, cela peut prendre plusieurs minutes. Ne ferme pas l’application."
            />
          )}
        </Carte>
      )}
    </div>
  )
}
