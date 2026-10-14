import { formaterCompetence } from '@core/adaptation/competences'
import { type ChoixComposition, choixInitial, composerCv } from '@core/adaptation/composition'
import type { FormatExport } from '@core/api'
import { type IdModele, trouverModele } from '@core/export/modeles'
import type { Profile, TailoredCv } from '@core/schemas'
import { useEffect, useMemo, useRef, useState } from 'react'
import { type DescriptionErreur, decrireErreur } from '../erreurs'
import { AlerteErreur, BarreActions, Bouton, CaseACocher, Champ, Icone, SectionRepliable } from '../ui'
import { CeQuiAChange } from './CeQuiAChange'
import { BandeModeles, GrandApercu, useApercus } from './GalerieModeles'

const remplacer = <T,>(liste: T[], indice: number, valeur: T) => liste.map((x, i) => (i === indice ? valeur : x))
const cle = (terme: string) => formaterCompetence(terme).toLowerCase()

/**
 * Étape ③ : le CV adapté en grand, des ajustements simples à côté, et le téléchargement toujours visible.
 * Rien d'absent du CV de départ n'y entre sans une case cochée par l'utilisateur.
 */
export function EcranNouveauCv({
  profil,
  adapte,
  onExporte,
}: {
  profil: Profile
  adapte: TailoredCv
  onExporte: (chemin: string) => void
}) {
  const [titre, setTitre] = useState(adapte.headline)
  const [accroche, setAccroche] = useState(adapte.summary)
  const [choix, setChoix] = useState<ChoixComposition>(() => choixInitial(adapte))
  const [points, setPoints] = useState<string[][]>(adapte.experiences.map((e) => e.bullets))
  // Compétences déjà dans le CV que l'utilisateur décoche : elles sont seulement retirées de ce CV.
  const [retirees, setRetirees] = useState<ReadonlySet<string>>(new Set())
  const [modeleCv, setModeleCv] = useState<IdModele>('classique')
  const [comparatif, setComparatif] = useState(false)
  const [pages, setPages] = useState(1)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  const [export_, setExport] = useState<FormatExport | null>(null)
  const dernierFormat = useRef<FormatExport>('pdf')

  // Dernière mise en page choisie (réglage mémorisé).
  useEffect(() => {
    window.api.lireParametres().then(
      (p) => setModeleCv(p.modeleCv),
      () => undefined,
    )
  }, [])

  const choisirModele = (id: IdModele) => {
    setModeleCv(id)
    window.api
      .lireParametres()
      .then(({ cleApiDefinie: _cle, ...p }) => window.api.enregistrerParametres({ ...p, modeleCv: id }))
      .catch(() => undefined)
  }

  // Compétences demandées par l'annonce et réellement présentes dans le CV adapté.
  const presentes = useMemo(() => {
    const dansLeCv = new Set([...adapte.keySkills, ...adapte.skills].map(cle))
    return adapte.requested.evidenced.filter((terme) => dansLeCv.has(cle(terme))).map(formaterCompetence)
  }, [adapte])

  const cvFinal = useMemo(() => {
    const compose = composerCv(profil, { ...adapte, headline: titre.trim(), summary: accroche.trim() }, choix, points)
    const garder = (competence: string) => !retirees.has(cle(competence))
    return {
      ...compose,
      competencesCles: compose.keySkills.filter(garder),
      competences: compose.skills.filter(garder),
    }
  }, [profil, adapte, titre, accroche, choix, points, retirees])

  const { apercus } = useApercus(cvFinal)
  const { excluded: ecartes } = adapte
  const { missing: manquantes } = adapte.requested
  const nbEcartes = ecartes.experiences.length + ecartes.skills.length + ecartes.education.length
  const modele = trouverModele(modeleCv)

  const exporter = async (format: FormatExport) => {
    dernierFormat.current = format
    setErreur(null)
    setExport(format)
    try {
      const chemin = await window.api.exporterCv(cvFinal, format, modeleCv)
      if (chemin) onExporte(chemin)
    } catch (e) {
      setErreur(decrireErreur('export', e))
    } finally {
      setExport(null)
    }
  }

  const majReintegrer = (partiel: Partial<ChoixComposition['reintegrer']>) =>
    setChoix((c) => ({ ...c, reintegrer: { ...c.reintegrer, ...partiel } }))

  const basculerPresente = (terme: string, gardee: boolean) =>
    setRetirees((actuelles) => {
      const suivantes = new Set(actuelles)
      if (gardee) suivantes.delete(cle(terme))
      else suivantes.add(cle(terme))
      return suivantes
    })

  return (
    <>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-8 px-6 py-8 lg:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="space-y-4">
          <header className="space-y-2">
            <p className="flex items-center gap-2 font-bold text-marque">
              <Icone nom="coche-cercle" />
              Votre CV est prêt
            </p>
            <h1 className="font-titre text-[1.75rem] leading-tight font-bold">
              Relisez, ajustez si besoin, puis téléchargez
            </h1>
          </header>

          <SectionRepliable titre="Titre et présentation" ouverte>
            <Champ etiquette="Titre du CV" valeur={titre} onChange={setTitre} />
            <Champ etiquette="Phrase de présentation" multiligne lignes={5} valeur={accroche} onChange={setAccroche} />
          </SectionRepliable>

          {(presentes.length > 0 || manquantes.length > 0) && (
            <SectionRepliable titre="Compétences mises en avant" ouverte>
              {presentes.length > 0 && (
                <fieldset>
                  <legend className="text-libelle font-bold text-marque">
                    Déjà dans votre CV · placées en premier
                  </legend>
                  {presentes.map((terme) => (
                    <CaseACocher
                      key={terme}
                      etiquette={terme}
                      coche={!retirees.has(cle(terme))}
                      onChange={(v) => basculerPresente(terme, v)}
                    />
                  ))}
                </fieldset>
              )}
              {manquantes.length > 0 && (
                <fieldset className="rounded-bouton bg-alerte-fond p-4">
                  <legend className="float-left w-full text-libelle font-bold text-alerte">
                    Demandées par l’annonce, absentes de votre CV
                  </legend>
                  <p className="clear-both pt-1.5 pb-1 text-petit text-alerte">
                    Cochez seulement ce que vous savez vraiment faire : on pourra vous interroger dessus en entretien.
                  </p>
                  {manquantes.map((terme, i) => (
                    <CaseACocher
                      key={terme}
                      etiquette={formaterCompetence(terme)}
                      coche={choix.ajouterDemandees[i] ?? false}
                      onChange={(v) =>
                        setChoix((c) => ({ ...c, ajouterDemandees: remplacer(c.ajouterDemandees, i, v) }))
                      }
                    />
                  ))}
                </fieldset>
              )}
            </SectionRepliable>
          )}

          {nbEcartes > 0 && (
            <SectionRepliable
              titre="Retiré de ce CV"
              compte={nbEcartes}
              resume="Sans rapport avec l’annonce · vous pouvez le remettre"
            >
              <fieldset>
                <legend className="text-petit text-aide">
                  Cochez ce que vous voulez remettre. Une expérience revient avec ses phrases de départ.
                </legend>
                {ecartes.experiences.map((e, i) => (
                  <CaseACocher
                    key={`${e.sourceIndex ?? i}-${e.position}-${e.company}`}
                    etiquette={`${e.position} — ${e.company}`}
                    aide={e.dateRange}
                    coche={choix.reintegrer.experiences[i] ?? false}
                    onChange={(v) => majReintegrer({ experiences: remplacer(choix.reintegrer.experiences, i, v) })}
                  />
                ))}
                {ecartes.education.map((f, i) => (
                  <CaseACocher
                    key={`${f.degree}-${f.school}`}
                    etiquette={`${f.degree} — ${f.school}`}
                    coche={choix.reintegrer.formations[i] ?? false}
                    onChange={(v) => majReintegrer({ formations: remplacer(choix.reintegrer.formations, i, v) })}
                  />
                ))}
                {ecartes.skills.map((c, i) => (
                  <CaseACocher
                    key={c}
                    etiquette={c}
                    coche={choix.reintegrer.competences[i] ?? false}
                    onChange={(v) => majReintegrer({ competences: remplacer(choix.reintegrer.competences, i, v) })}
                  />
                ))}
              </fieldset>
            </SectionRepliable>
          )}

          <Bouton
            variante="secondaire"
            icone={comparatif ? 'oeil' : 'comparer'}
            onClick={() => setComparatif((c) => !c)}
          >
            {comparatif ? 'Revenir à l’aperçu' : 'Voir ce qui a changé'}
          </Bouton>
        </div>

        <div className="min-w-0 space-y-5">
          {erreur && <AlerteErreur description={erreur} surAction={() => void exporter(dernierFormat.current)} />}
          {comparatif ? (
            <CeQuiAChange
              profil={profil}
              adapte={adapte}
              cvFinal={cvFinal}
              titre={titre}
              onTitre={setTitre}
              accroche={accroche}
              onAccroche={setAccroche}
              points={points}
              onPoints={setPoints}
              choix={choix}
              onChoix={setChoix}
            />
          ) : (
            <>
              <BandeModeles apercus={apercus} valeur={modeleCv} onChange={choisirModele} />
              <GrandApercu
                html={apercus[modeleCv]?.html}
                erreur={apercus[modeleCv]?.erreur}
                nomModele={modele.nom}
                onPages={setPages}
              />
            </>
          )}
        </div>
      </div>

      <BarreActions
        largeur="max-w-7xl"
        gauche={`Mise en page « ${modele.nom} » · ${pages} page${pages > 1 ? 's' : ''}`}
      >
        <Bouton
          variante="sur-sombre"
          onClick={() => void exporter('docx')}
          enCours={export_ === 'docx'}
          desactive={export_ !== null}
        >
          Version Word (.docx)
        </Bouton>
        <Bouton
          variante="accent"
          taille="grand"
          icone="telecharger"
          onClick={() => void exporter('pdf')}
          enCours={export_ === 'pdf'}
          desactive={export_ !== null}
        >
          Télécharger en PDF
        </Bouton>
      </BarreActions>
    </>
  )
}
