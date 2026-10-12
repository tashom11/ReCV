import type { CvGenere } from '@core/api'
import type { Offre } from '@core/schemas'
import { useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'

type Mode = 'url' | 'texte'

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
  const [occupe, setOccupe] = useState<null | 'recuperation' | 'adaptation'>(null)
  const [erreur, setErreur] = useState<string | null>(null)

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
    setOccupe('recuperation')
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

  return (
    <div className="space-y-5">
      <Titre sousTitre="Indique l’annonce à viser : lien vers l’offre, ou texte collé si le site la bloque.">
        Offre d’emploi
      </Titre>
      {!profilPresent && <Alerte type="avertissement">Importe d’abord ton CV dans l’onglet « Profil ».</Alerte>}
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex gap-2">
          <Bouton variante={mode === 'url' ? 'principal' : 'secondaire'} onClick={() => setMode('url')}>
            Depuis un lien
          </Bouton>
          <Bouton variante={mode === 'texte' ? 'principal' : 'secondaire'} onClick={() => setMode('texte')}>
            Coller le texte
          </Bouton>
        </div>

        {mode === 'url' ? (
          <div className="space-y-3">
            <Champ etiquette="Adresse de l’offre" type="url" valeur={url} onChange={setUrl} placeholder="https://…" />
            <Bouton onClick={recuperer} desactive={!url.trim() || occupe !== null}>
              {occupe === 'recuperation' ? 'Récupération…' : 'Récupérer l’offre'}
            </Bouton>
          </div>
        ) : (
          <div className="space-y-3">
            <Champ etiquette="Texte de l’offre" multiligne lignes={10} valeur={texte} onChange={setTexte} />
            <Bouton onClick={analyser} desactive={!texte.trim() || occupe !== null}>
              {occupe === 'recuperation' ? 'Analyse…' : 'Analyser l’offre'}
            </Bouton>
          </div>
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
          {occupe === 'adaptation' && (
            <Alerte type="info">
              Adaptation en cours : avec un modèle local, cela peut prendre plusieurs minutes. Ne ferme pas
              l’application.
            </Alerte>
          )}
          <Bouton onClick={adapter} desactive={!profilPresent || occupe !== null}>
            {occupe === 'adaptation' ? 'Adaptation…' : 'Adapter mon CV'}
          </Bouton>
        </Carte>
      )}
    </div>
  )
}
