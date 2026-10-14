import type { JobPostingPreview } from '@core/api'
import type { JobPosting, Requirements } from '@core/schemas'
import { useState } from 'react'
import { type ActionErreur, type DescriptionErreur, decrireErreur } from '../erreurs'
import { dureeAnnoncee } from '../estimation'
import { useProgressionTache } from '../progression'
import { AlerteErreur, Bouton, BoutonLien, Champ, Chargement, Icone, OngletsSegmentes, Pastille, Titre } from '../ui'

type Mode = 'lien' | 'texte'

export interface AnnonceLue {
  offre: JobPosting
  apercu: JobPostingPreview
}

const ID_PANNEAU = 'saisie-annonce'

/** Ce que l'annonce souhaite et que le CV ne montre pas : dit sans décourager. */
function bonASavoir(prerequis: Requirements): string | null {
  const phrases: string[] = []
  if (prerequis.experience?.status === 'not-found') {
    phrases.push(`l’annonce souhaite « ${prerequis.experience.required} ». Cela n’apparaît pas dans votre CV`)
  }
  if (prerequis.education?.status === 'insufficient') {
    const profil = prerequis.education.profileValue ? ` (votre CV indique « ${prerequis.education.profileValue} »)` : ''
    phrases.push(`l’annonce demande « ${prerequis.education.required} »${profil}`)
  }
  if (phrases.length === 0) return null
  return `${phrases.join(' ; ')}, mais cela ne vous empêche pas de postuler.`
}

/** Étape ② : lien ou texte de l'annonce, puis carte de confirmation de ce qui a été lu. */
export function EcranAnnonce({
  annonce,
  onAnnonce,
  estimationS,
  erreurCreation,
  onCreer,
  onRetourCv,
  onPreparer,
}: {
  annonce: AnnonceLue | null
  onAnnonce: (annonce: AnnonceLue | null) => void
  /** Durée estimée de la création, en secondes. */
  estimationS: number
  /** Dernière création interrompue par une erreur, à signaler au-dessus de la carte. */
  erreurCreation: DescriptionErreur | null
  onCreer: () => void
  onRetourCv: () => void
  onPreparer: () => void
}) {
  const [mode, setMode] = useState<Mode>('lien')
  const [url, setUrl] = useState('')
  const [texte, setTexte] = useState('')
  const [occupe, setOccupe] = useState<'lecture' | 'analyse' | null>(null)
  const [erreur, setErreur] = useState<DescriptionErreur | null>(null)
  const [correction, setCorrection] = useState<JobPosting | null>(null)
  const progression = useProgressionTache('offre', occupe !== null)

  // Lit l'annonce (lien ou texte), puis repère ce que l'employeur recherche : la carte de confirmation en dépend.
  const lire = async (source: Mode | JobPosting) => {
    setErreur(null)
    setOccupe('lecture')
    try {
      const offre =
        typeof source !== 'string'
          ? source
          : source === 'lien'
            ? await window.api.fetchJobPosting(url.trim())
            : await window.api.parseJobPostingText(texte)
      setOccupe('analyse')
      onAnnonce({ offre, apercu: await window.api.previewJobPosting(offre) })
      setCorrection(null)
    } catch (e) {
      setErreur(decrireErreur('annonce', e))
    } finally {
      setOccupe(null)
    }
  }

  const surActionErreur = (action: ActionErreur) => {
    setErreur(null)
    if (action === 'coller-texte') setMode('texte')
    else if (action === 'terminer-preparation') onPreparer()
    else void lire(annonce ? annonce.offre : mode)
  }

  const chargement = occupe && (
    <Chargement
      titre={occupe === 'lecture' && mode === 'lien' ? 'Nous ouvrons la page de l’annonce…' : 'Nous lisons l’annonce…'}
      etape={progression ? 'Nous repérons le poste et ce que l’employeur recherche' : undefined}
      note="Cela prend généralement moins d’une minute."
    />
  )

  if (annonce) {
    const { offre, apercu } = annonce
    const note = bonASavoir(apercu.requirements)
    const details = [offre.company, offre.location, apercu.contractType].filter((v) => v && v.trim() !== '')
    return (
      <div className="mx-auto w-full max-w-4xl space-y-7 px-6 py-12">
        <Titre surtitre="Annonce lue">C’est bien cette annonce ?</Titre>
        {erreurCreation && (
          <AlerteErreur
            description={erreurCreation}
            surAction={(action) => (action === 'terminer-preparation' ? onPreparer() : onCreer())}
          />
        )}
        {erreur && <AlerteErreur description={erreur} surAction={surActionErreur} />}

        <article className="rounded-panneau border border-trait bg-surface shadow-panneau">
          <div className="space-y-6 p-8">
            <header className="flex items-start gap-5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-carte bg-marque-pale text-marque">
                <Icone nom="mallette" taille={28} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.75rem] leading-tight font-bold text-encre">{offre.jobTitle}</h2>
                {details.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-x-5 text-intro text-encre-douce">
                    {details.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </p>
                )}
              </div>
            </header>

            {apercu.soughtSkills.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-corps font-bold text-encre">Ce que l’employeur recherche</h3>
                <ul className="flex flex-wrap gap-2.5">
                  {apercu.soughtSkills.map((terme) => (
                    <li key={terme}>
                      <Pastille>{terme}</Pastille>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {note && (
              <p className="flex items-start gap-3 rounded-carte bg-info-fond px-5 py-4 text-info">
                <Icone nom="info" className="mt-0.5" />
                <span>
                  <strong>Bon à savoir :</strong> {note}
                </span>
              </p>
            )}
          </div>

          <details className="group border-t border-trait">
            <summary className="flex min-h-16 items-center gap-3 rounded-b-panneau px-8 font-bold text-marque">
              <Icone nom="oeil" />
              <span className="flex-1">Voir le texte complet de l’annonce</span>
              <Icone nom="chevron-bas" className="transition-transform duration-(--duree) group-open:rotate-180" />
            </summary>
            <div className="space-y-4 px-8 pb-8">
              {correction ? (
                <>
                  <Champ
                    etiquette="Intitulé du poste"
                    valeur={correction.jobTitle}
                    onChange={(v) => setCorrection({ ...correction, jobTitle: v })}
                  />
                  <Champ
                    etiquette="Texte de l’annonce"
                    multiligne
                    lignes={12}
                    valeur={correction.rawText}
                    onChange={(v) => setCorrection({ ...correction, rawText: v })}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Bouton
                      onClick={() => void lire(correction)}
                      enCours={occupe !== null}
                      desactive={!correction.jobTitle.trim() || !correction.rawText.trim()}
                    >
                      Relire l’annonce corrigée
                    </Bouton>
                    <Bouton variante="secondaire" onClick={() => setCorrection(null)} desactive={occupe !== null}>
                      Ne rien changer
                    </Bouton>
                  </div>
                  {chargement}
                </>
              ) : (
                <>
                  <p className="max-h-80 overflow-y-auto rounded-champ bg-papier p-4 whitespace-pre-wrap text-encre">
                    {offre.rawText}
                  </p>
                  <Bouton variante="secondaire" icone="crayon" onClick={() => setCorrection(offre)}>
                    Corriger le texte
                  </Bouton>
                </>
              )}
            </div>
          </details>
        </article>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <BoutonLien icone="fleche-gauche" onClick={() => onAnnonce(null)}>
            Ce n’est pas la bonne annonce
          </BoutonLien>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-corps text-encre-douce">{dureeAnnoncee(estimationS)}</span>
            <Bouton taille="grand" iconeFin="fleche-droite" onClick={onCreer} desactive={occupe !== null}>
              Créer mon CV adapté
            </Bouton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-12">
      <Titre sousTitre="Donnez-nous l’adresse de l’annonce. Si le site ne se laisse pas lire, collez simplement son texte.">
        Quelle annonce vous intéresse ?
      </Titre>
      {erreur && <AlerteErreur description={erreur} surAction={surActionErreur} />}

      <section className="space-y-6 rounded-panneau border border-trait bg-surface p-8 shadow-carte">
        <OngletsSegmentes
          etiquette="Façon de donner l’annonce"
          idPanneau={ID_PANNEAU}
          valeur={mode}
          onChange={setMode}
          desactive={occupe !== null}
          onglets={[
            { id: 'lien', libelle: 'Coller un lien', icone: 'lien' },
            { id: 'texte', libelle: 'Coller le texte', icone: 'presse-papiers' },
          ]}
        />
        <div id={ID_PANNEAU} role="tabpanel" aria-labelledby={`${ID_PANNEAU}-onglet-${mode}`} className="space-y-5">
          {mode === 'lien' ? (
            <Champ
              etiquette="Adresse de l’annonce"
              type="url"
              grand
              valeur={url}
              onChange={setUrl}
              placeholder="Collez ici l’adresse (elle commence par https://)"
              aide="Astuce : dans votre navigateur, cliquez sur la barre d’adresse puis faites Ctrl + C pour copier."
            />
          ) : (
            <Champ
              etiquette="Texte de l’annonce"
              multiligne
              lignes={10}
              valeur={texte}
              onChange={setTexte}
              placeholder="Collez ici tout le texte de l’annonce"
              aide="Astuce : sur la page de l’annonce, sélectionnez le texte avec la souris, faites Ctrl + C, puis Ctrl + V ici."
            />
          )}
          <Bouton
            taille="grand"
            onClick={() => void lire(mode)}
            enCours={occupe !== null}
            desactive={mode === 'lien' ? !url.trim() : !texte.trim()}
          >
            Lire l’annonce
          </Bouton>
          {chargement}
        </div>
      </section>

      <BoutonLien icone="fleche-gauche" onClick={onRetourCv}>
        Revenir à mon CV
      </BoutonLien>
    </div>
  )
}
