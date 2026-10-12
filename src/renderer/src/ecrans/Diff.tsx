import type { FormatExport } from '@core/api'
import type { CvAdapte, Offre, Profil } from '@core/schemas'
import { useMemo, useState } from 'react'
import { Alerte, Bouton, Carte, Champ, messageErreur, Titre } from '../ui'

interface Choix {
  titre: boolean
  accroche: boolean
  competences: boolean
  /** Une entrée par expérience : garder la version adaptée (true) ou l'originale (false). */
  experiences: boolean[]
}

const lignes = (texte: string) => texte.split('\n')
const nettoyer = (valeurs: string[]) => valeurs.map((v) => v.trim()).filter(Boolean)

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

/** Compose le CV final selon les choix de l'utilisateur ; les faits viennent toujours du profil. */
export function composerCv(profil: Profil, adapte: CvAdapte, choix: Choix, points: string[][]): CvAdapte {
  return {
    ...adapte,
    titre: choix.titre ? adapte.titre : (profil.titrePoste ?? adapte.titre),
    accroche: choix.accroche ? adapte.accroche : (profil.accroche ?? adapte.accroche),
    competences: choix.competences ? adapte.competences : profil.competences,
    experiences: adapte.experiences.map((experience, i) => ({
      ...experience,
      points: choix.experiences[i]
        ? nettoyer(points[i] ?? experience.points)
        : (profil.experiences[i]?.realisations ?? experience.points),
    })),
  }
}

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
  const [choix, setChoix] = useState<Choix>({
    titre: true,
    accroche: true,
    competences: true,
    experiences: adapte.experiences.map(() => true),
  })
  const [points, setPoints] = useState<string[][]>(adapte.experiences.map((e) => e.points))
  const [valide, setValide] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fichier, setFichier] = useState<string | null>(null)

  const cvFinal = useMemo(
    () => composerCv(profil, { ...adapte, titre: titre.trim(), accroche: accroche.trim() }, choix, points),
    [profil, adapte, titre, accroche, choix, points],
  )

  const exporter = async (format: FormatExport) => {
    setErreur(null)
    try {
      const chemin = await window.api.exporterCv(cvFinal, format)
      if (chemin) setFichier(chemin)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const basculerExperience = (i: number, v: boolean) =>
    setChoix((c) => ({ ...c, experiences: c.experiences.map((x, j) => (j === i ? v : x)) }))

  return (
    <div className="space-y-5">
      <Titre
        sousTitre={`Compare ce qui a été reformulé pour « ${offre.titrePoste} » : tu peux corriger ou refuser chaque partie.`}
      >
        Vérifier le CV adapté
      </Titre>
      <Alerte type="info">
        Seules la formulation et la priorité changent. Postes, entreprises, dates, formations et langues viennent
        toujours de ton profil.
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
        const originale = profil.experiences[i]
        return (
          <Carte
            key={`${experience.poste}-${experience.entreprise}-${experience.periode ?? ''}`}
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
              onChange={(v) => basculerExperience(i, v)}
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
          etiquette="Garder l’ordre adapté (compétences de l’offre en premier)"
        />
      </Carte>

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
