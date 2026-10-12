import { type ChoixComposition, choixInitial, composerCv } from '@core/adaptation/composition'
import type { FormatExport } from '@core/api'
import type { CvAdapte, Offre, Profil } from '@core/schemas'
import { useMemo, useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'

const lignes = (texte: string) => texte.split('\n')

function Colonnes({ avant, apres }: { avant: React.ReactNode; apres: React.ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1 rounded-md bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avant</p>
        {avant}
      </div>
      <div className="space-y-1 rounded-md bg-indigo-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Après</p>
        {apres}
      </div>
    </div>
  )
}

function Garder({ actif, onChange, etiquette }: { actif: boolean; onChange: (v: boolean) => void; etiquette: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={actif} onChange={(e) => onChange(e.target.checked)} />
      {etiquette}
    </label>
  )
}

const remplacer = <T,>(liste: T[], indice: number, valeur: T) => liste.map((x, i) => (i === indice ? valeur : x))

export function EcranDiff({
  profil,
  offre,
  adapte,
  onValider,
  onRetour,
}: {
  profil: Profil
  offre: Offre
  adapte: CvAdapte
  onValider: (cv: CvAdapte) => void
  onRetour: () => void
}) {
  const [titre, setTitre] = useState(adapte.titre)
  const [accroche, setAccroche] = useState(adapte.accroche)
  const [choix, setChoix] = useState<ChoixComposition>(() => choixInitial(adapte))
  const [points, setPoints] = useState<string[][]>(adapte.experiences.map((e) => e.points))
  const [valide, setValide] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fichier, setFichier] = useState<string | null>(null)

  const cvFinal = useMemo(
    () => composerCv(profil, { ...adapte, titre: titre.trim(), accroche: accroche.trim() }, choix, points),
    [profil, adapte, titre, accroche, choix, points],
  )

  const { ecartes } = adapte
  const nbEcartes = ecartes.experiences.length + ecartes.competences.length + ecartes.formations.length

  const exporter = async (format: FormatExport) => {
    setErreur(null)
    try {
      const chemin = await window.api.exporterCv(cvFinal, format)
      if (chemin) setFichier(chemin)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const majReintegrer = (partiel: Partial<ChoixComposition['reintegrer']>) =>
    setChoix((c) => ({ ...c, reintegrer: { ...c.reintegrer, ...partiel } }))

  return (
    <div className="space-y-5">
      <Titre
        sousTitre={`Compare ce qui a été reformulé pour « ${offre.titrePoste} » : tu peux corriger ou refuser chaque partie.`}
      >
        Vérifier le CV adapté
      </Titre>
      <Alerte type="info">
        Seules la formulation, la sélection et la priorité changent. Postes, entreprises, dates, formations et langues
        viennent toujours de ton profil.
        {nbEcartes > 0 &&
          ' Les éléments sans rapport avec l’offre ont été écartés du CV : ils sont listés en bas, tu peux les réintégrer.'}
      </Alerte>

      <Carte titre="Titre">
        <Colonnes
          avant={<p className="text-sm text-slate-800">{profil.titrePoste || '—'}</p>}
          apres={<Champ etiquette="Titre adapté" valeur={titre} onChange={setTitre} />}
        />
        <Garder
          actif={choix.titre}
          onChange={(v) => setChoix((c) => ({ ...c, titre: v }))}
          etiquette="Garder le titre adapté"
        />
      </Carte>

      <Carte titre="Accroche">
        <Colonnes
          avant={<p className="whitespace-pre-wrap text-sm text-slate-800">{profil.accroche || '—'}</p>}
          apres={<Champ etiquette="Accroche adaptée" multiligne valeur={accroche} onChange={setAccroche} />}
        />
        <Garder
          actif={choix.accroche}
          onChange={(v) => setChoix((c) => ({ ...c, accroche: v }))}
          etiquette="Garder l’accroche adaptée"
        />
      </Carte>

      {adapte.experiences.map((experience, i) => {
        const originale = profil.experiences[experience.indice ?? i]
        return (
          <Carte
            key={`${experience.indice ?? i}-${experience.poste}-${experience.entreprise}`}
            titre={`${experience.poste} — ${experience.entreprise}`}
          >
            <Colonnes
              avant={
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
                  {(originale?.realisations ?? []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              }
              apres={
                <Champ
                  etiquette="Points adaptés (un par ligne)"
                  multiligne
                  lignes={Math.max(4, (points[i]?.length ?? 0) + 1)}
                  valeur={(points[i] ?? []).join('\n')}
                  onChange={(v) => setPoints((p) => p.map((x, j) => (j === i ? lignes(v) : x)))}
                />
              }
            />
            <Garder
              actif={choix.experiences[i] ?? true}
              onChange={(v) => setChoix((c) => ({ ...c, experiences: remplacer(c.experiences, i, v) }))}
              etiquette="Garder les points adaptés"
            />
          </Carte>
        )
      })}

      <Carte titre="Compétences">
        <Colonnes
          avant={<p className="text-sm text-slate-800">{profil.competences.join(', ') || '—'}</p>}
          apres={<p className="text-sm text-slate-800">{adapte.competences.join(', ') || '—'}</p>}
        />
        <Garder
          actif={choix.competences}
          onChange={(v) => setChoix((c) => ({ ...c, competences: v }))}
          etiquette="Garder la sélection adaptée (compétences pertinentes, celles de l’offre en premier)"
        />
      </Carte>

      {adapte.formations.length > 0 && (
        <Carte titre="Formations conservées">
          <ul className="space-y-1 text-sm text-slate-800">
            {adapte.formations.map((f) => (
              <li key={`${f.diplome}-${f.etablissement}`}>
                {f.diplome} — {f.etablissement}
                {f.periode ? ` (${f.periode})` : ''}
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {nbEcartes > 0 && (
        <Carte titre="Écarté du CV (sans rapport avec l’offre)">
          <p className="text-xs text-slate-600">
            Coche ce que tu veux malgré tout réintégrer : les expériences reprennent alors leurs réalisations d’origine,
            sans reformulation.
          </p>

          {ecartes.experiences.map((e, i) => (
            <Garder
              key={`${e.indice ?? i}-${e.poste}-${e.entreprise}`}
              actif={choix.reintegrer.experiences[i] ?? false}
              onChange={(v) => majReintegrer({ experiences: remplacer(choix.reintegrer.experiences, i, v) })}
              etiquette={`Expérience : ${e.poste} — ${e.entreprise}${e.periode ? ` (${e.periode})` : ''}`}
            />
          ))}

          {ecartes.formations.map((f, i) => (
            <Garder
              key={`${f.diplome}-${f.etablissement}`}
              actif={choix.reintegrer.formations[i] ?? false}
              onChange={(v) => majReintegrer({ formations: remplacer(choix.reintegrer.formations, i, v) })}
              etiquette={`Formation : ${f.diplome} — ${f.etablissement}`}
            />
          ))}

          {ecartes.competences.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">Compétences</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {ecartes.competences.map((c, i) => (
                  <Garder
                    key={c}
                    actif={choix.reintegrer.competences[i] ?? false}
                    onChange={(v) => majReintegrer({ competences: remplacer(choix.reintegrer.competences, i, v) })}
                    etiquette={c}
                  />
                ))}
              </div>
            </div>
          )}
        </Carte>
      )}

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {fichier && <Alerte type="succes">CV enregistré : {fichier}</Alerte>}
      {valide && (
        <Carte titre="Exporter">
          <p className="text-xs text-slate-600">
            Mise en page sobre sur une colonne, avec du vrai texte : lisible par les logiciels de recrutement (ATS).
          </p>
          <div className="flex gap-3">
            <Bouton onClick={() => exporter('pdf')}>Exporter en PDF</Bouton>
            <Bouton variante="secondaire" onClick={() => exporter('docx')}>
              Exporter en DOCX
            </Bouton>
          </div>
        </Carte>
      )}
      <div className="flex gap-3">
        <Bouton
          onClick={() => {
            onValider(cvFinal)
            setValide(true)
          }}
        >
          Valider ce CV
        </Bouton>
        <Bouton variante="secondaire" onClick={onRetour}>
          Retour à l’offre
        </Bouton>
      </div>
    </div>
  )
}
