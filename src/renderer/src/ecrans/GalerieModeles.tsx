import { type IdModele, MODELES_CV } from '@core/export/modeles'
import type { CvAdapte } from '@core/schemas'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Alerte, Bouton, Carte, Spinner } from '../ui'

type Apercus = Partial<Record<IdModele, { html?: string; erreur?: string }>>

// Taille de la page A4 en pixels CSS (96 dpi) : le CV est rendu à cette taille puis réduit à la largeur de la carte.
const LARGEUR_PAGE = 794
const HAUTEUR_PAGE = 1123

/** Page A4 réduite : le HTML du CV est affiché dans un cadre isolé (sans script) mis à l'échelle. */
function Vignette({ html, titre }: { html: string; titre: string }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(0.3)

  useLayoutEffect(() => {
    const element = conteneur.current
    if (!element) return
    const mesurer = () => setEchelle(element.clientWidth / LARGEUR_PAGE)
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  return (
    <div ref={conteneur} className="aspect-[794/1123] w-full overflow-hidden rounded border border-slate-200 bg-white">
      <iframe
        title={titre}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        className="pointer-events-none origin-top-left border-0"
        style={{ width: LARGEUR_PAGE, height: HAUTEUR_PAGE, transform: `scale(${echelle})` }}
      />
    </div>
  )
}

/**
 * Galerie des modèles de CV : chaque vignette est le vrai rendu du CV (photo comprise) avec ce modèle.
 * Le choix est mémorisé dans les paramètres et sert à l'export PDF/DOCX.
 */
export function GalerieModeles({
  cv,
  valeur,
  onChange,
}: {
  cv: CvAdapte
  valeur: IdModele
  onChange: (id: IdModele) => void
}) {
  const [apercus, setApercus] = useState<Apercus>({})
  const [enCours, setEnCours] = useState(false)
  // Le contenu du CV change à chaque modification : les aperçus ne sont recalculés que sur demande.
  const cvCourant = useRef(cv)
  cvCourant.current = cv
  // Numéro de génération : une génération plus récente rend caduques les réponses des précédentes.
  const generation = useRef(0)

  const actualiser = useCallback(async () => {
    const numero = ++generation.current
    setEnCours(true)
    setApercus({})
    for (const modele of MODELES_CV) {
      try {
        const html = await window.api.htmlModeleCv(cvCourant.current, modele.id)
        if (numero !== generation.current) return
        setApercus((a) => ({ ...a, [modele.id]: { html } }))
      } catch (e) {
        if (numero !== generation.current) return
        setApercus((a) => ({ ...a, [modele.id]: { erreur: e instanceof Error ? e.message : String(e) } }))
      }
    }
    if (numero === generation.current) setEnCours(false)
  }, [])

  useEffect(() => {
    void actualiser()
  }, [actualiser])

  return (
    <Carte titre="Modèle de CV">
      <p className="text-xs text-slate-600">
        Choisis la mise en page avant d’exporter. Tous les modèles gardent une seule colonne et du vrai texte : ils
        restent lisibles par les logiciels de recrutement.
      </p>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Modèle de CV</legend>
        {MODELES_CV.map((m) => {
          const apercu = apercus[m.id]
          return (
            <label key={m.id} className="block cursor-pointer">
              <input
                type="radio"
                name="modele-cv"
                className="peer sr-only"
                checked={m.id === valeur}
                onChange={() => onChange(m.id)}
              />
              <div className="space-y-2 rounded-lg border border-slate-200 p-2 transition hover:border-slate-400 peer-checked:border-indigo-600 peer-checked:ring-2 peer-checked:ring-indigo-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400">
                {apercu?.html ? (
                  <Vignette html={apercu.html} titre={`Aperçu du modèle ${m.nom}`} />
                ) : (
                  <div className="flex aspect-[794/1123] items-center justify-center rounded border border-slate-200 bg-white">
                    {apercu?.erreur ? (
                      <span className="px-2 text-center text-xs text-slate-500">Aperçu indisponible</span>
                    ) : (
                      <Spinner taille={20} />
                    )}
                  </div>
                )}
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: m.couleur }}
                      aria-hidden="true"
                    />
                    {m.nom}
                    {m.id === valeur && <span className="text-xs font-normal text-indigo-700">Choisi</span>}
                  </p>
                  <p className="text-xs text-slate-600">{m.description}</p>
                </div>
              </div>
            </label>
          )
        })}
      </fieldset>
      <div className="flex items-center gap-3">
        <Bouton variante="secondaire" onClick={() => void actualiser()} enCours={enCours} desactive={enCours}>
          {enCours ? 'Création des aperçus…' : 'Actualiser les aperçus'}
        </Bouton>
        <span className="text-xs text-slate-500">À refaire après avoir modifié le CV ou la photo.</span>
      </div>
      {Object.values(apercus).some((a) => a?.erreur) && (
        <Alerte type="info">Un aperçu n’a pas pu être généré ; le modèle reste utilisable pour l’export.</Alerte>
      )}
    </Carte>
  )
}
