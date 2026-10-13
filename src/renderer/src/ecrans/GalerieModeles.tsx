import { type IdModele, MODELES_CV } from '@core/export/modeles'
import type { CvAdapte } from '@core/schemas'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Spinner, VignetteModele } from '../ui'

export type Apercus = Partial<Record<IdModele, { html?: string; erreur?: string }>>

// Taille de la page A4 en pixels CSS (96 dpi) : le CV est rendu à cette taille puis réduit à la largeur disponible.
const LARGEUR_PAGE = 794
const HAUTEUR_PAGE = 1123
const DELAI_ACTUALISATION_MS = 400

/**
 * Aperçus du CV dans chaque mise en page (le vrai rendu, photo comprise), recalculés peu après la dernière
 * modification. Les anciens aperçus restent affichés pendant le recalcul : rien ne clignote.
 */
export function useApercus(cv: CvAdapte): { apercus: Apercus; enCours: boolean } {
  const [apercus, setApercus] = useState<Apercus>({})
  const [enCours, setEnCours] = useState(true)
  // Numéro de génération : une génération plus récente rend caduques les réponses des précédentes.
  const generation = useRef(0)

  useEffect(() => {
    const numero = ++generation.current
    setEnCours(true)
    const minuteur = setTimeout(async () => {
      for (const modele of MODELES_CV) {
        let apercu: { html?: string; erreur?: string }
        try {
          apercu = { html: await window.api.htmlModeleCv(cv, modele.id) }
        } catch (e) {
          apercu = { erreur: e instanceof Error ? e.message : String(e) }
        }
        if (numero !== generation.current) return
        setApercus((a) => ({ ...a, [modele.id]: apercu }))
      }
      setEnCours(false)
    }, DELAI_ACTUALISATION_MS)
    return () => clearTimeout(minuteur)
  }, [cv])

  return { apercus, enCours }
}

/** Page A4 réduite à la largeur de son conteneur : le HTML du CV est affiché dans un cadre isolé, sans script. */
function PageReduite({ html, titre }: { html: string; titre: string }) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(0.1)

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
    <div
      ref={conteneur}
      className="aspect-[794/1123] w-full overflow-hidden rounded-[4px] border border-trait bg-white"
    >
      <iframe
        title={titre}
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none origin-top-left border-0"
        style={{ width: LARGEUR_PAGE, height: HAUTEUR_PAGE, transform: `scale(${echelle})` }}
      />
    </div>
  )
}

/** Choix de la mise en page par vignettes : chacune montre le CV réel dans ce modèle. */
export function BandeModeles({
  apercus,
  valeur,
  onChange,
}: {
  apercus: Apercus
  valeur: IdModele
  onChange: (id: IdModele) => void
}) {
  return (
    <fieldset>
      <legend className="pb-2.5 text-corps font-bold text-encre">Mise en page</legend>
      <div className="flex flex-wrap gap-3">
        {MODELES_CV.map((m) => {
          const html = apercus[m.id]?.html
          return (
            <VignetteModele key={m.id} nom={m.nom} choisi={m.id === valeur} onChoisir={() => onChange(m.id)}>
              {html ? (
                <PageReduite html={html} titre={`Aperçu de la mise en page ${m.nom}`} />
              ) : (
                <span className="flex aspect-[794/1123] items-center justify-center rounded-[4px] border border-trait bg-white text-trait-fort">
                  {apercus[m.id]?.erreur ? <span className="text-petit text-aide">—</span> : <Spinner taille={18} />}
                </span>
              )}
            </VignetteModele>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Le CV en grand, tel qu'il sera téléchargé. Le cadre est isolé et sans script ; `allow-same-origin` sert
 * uniquement à mesurer la hauteur du contenu pour compter les pages.
 */
export function GrandApercu({
  html,
  erreur,
  nomModele,
  onPages,
}: {
  html?: string
  erreur?: string
  nomModele: string
  onPages: (pages: number) => void
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [echelle, setEchelle] = useState(0.8)
  const [pages, setPages] = useState(1)

  useLayoutEffect(() => {
    const element = conteneur.current
    if (!element) return
    const mesurer = () => setEchelle(Math.min(1, element.clientWidth / LARGEUR_PAGE))
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  const hauteur = pages * HAUTEUR_PAGE

  return (
    <section aria-label="Aperçu de votre CV" className="rounded-panneau bg-creux p-6 lg:p-8">
      <div ref={conteneur} className="mx-auto w-full max-w-[660px]">
        {html ? (
          <div className="overflow-hidden bg-white shadow-panneau" style={{ height: hauteur * echelle }}>
            <iframe
              title={`Votre CV, mise en page ${nomModele}`}
              srcDoc={html}
              sandbox="allow-same-origin"
              className="origin-top-left border-0"
              style={{ width: LARGEUR_PAGE, height: hauteur, transform: `scale(${echelle})` }}
              onLoad={(e) => {
                // La hauteur du corps est celle du contenu, quelle que soit celle du cadre.
                const contenu = e.currentTarget.contentDocument?.body.scrollHeight ?? HAUTEUR_PAGE
                const nombre = Math.max(1, Math.ceil((contenu - 8) / HAUTEUR_PAGE))
                setPages(nombre)
                onPages(nombre)
              }}
            />
          </div>
        ) : (
          <div className="flex aspect-[794/1123] flex-col items-center justify-center gap-3 bg-white text-encre-douce shadow-panneau">
            {erreur ? (
              <p className="max-w-xs px-6 text-center">
                L’aperçu n’a pas pu s’afficher. Vous pouvez quand même télécharger votre CV.
              </p>
            ) : (
              <>
                <span className="text-marque">
                  <Spinner taille={28} />
                </span>
                <p role="status">Nous mettons votre CV en page…</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
