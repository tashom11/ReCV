import type { Profile, TailoredCv } from '@core/schemas'
import type { CompositionChoices } from '@core/tailoring/composition'
import type { ReactNode } from 'react'
import { CaseACocher, Champ } from '../ui'

const lignes = (texte: string) => texte.split('\n')
const remplacer = <T,>(liste: T[], indice: number, valeur: T) => liste.map((x, i) => (i === indice ? valeur : x))

function Comparaison({
  titre,
  avant,
  apres,
  garder,
}: {
  titre: string
  avant: ReactNode
  apres: ReactNode
  garder: ReactNode
}) {
  return (
    <section className="space-y-4 rounded-carte border border-trait bg-surface p-6 shadow-carte">
      <h3 className="font-titre text-intro font-bold text-encre">{titre}</h3>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2 rounded-bouton bg-papier p-4">
          <p className="text-petit font-bold text-encre-douce">Dans votre CV de départ</p>
          <div className="text-corps text-encre">{avant}</div>
        </div>
        <div className="space-y-2 rounded-bouton bg-marque-pale p-4">
          <p className="text-petit font-bold text-marque">Dans ce nouveau CV</p>
          {apres}
        </div>
      </div>
      {garder}
    </section>
  )
}

/**
 * Comparatif « avant / après », partie par partie. C'est une option de l'étape ③ : on y corrige les phrases
 * des expériences et on peut revenir, pour chaque partie, à la version de départ.
 */
export function CeQuiAChange({
  profil,
  adapte,
  cvFinal,
  titre,
  onTitre,
  accroche,
  onAccroche,
  points,
  onPoints,
  choix,
  onChoix,
}: {
  profil: Profile
  adapte: TailoredCv
  /** CV tel qu'il sera téléchargé (compétences composées). */
  cvFinal: TailoredCv
  titre: string
  onTitre: (titre: string) => void
  accroche: string
  onAccroche: (accroche: string) => void
  points: string[][]
  onPoints: (points: string[][]) => void
  choix: CompositionChoices
  onChoix: (choix: CompositionChoices) => void
}) {
  const competencesFinales = [...cvFinal.keySkills, ...cvFinal.skills]
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-titre text-titre-section font-bold">Ce qui a changé</h2>
        <p className="text-corps text-encre-douce">
          Vos postes, dates et formations ne changent pas : nous choisissons et réordonnons ce qui vient de votre CV.
        </p>
      </header>

      <Comparaison
        titre="Titre du CV"
        avant={<p>{profil.headline || '—'}</p>}
        apres={<Champ etiquette="Titre adapté à l’annonce" valeur={titre} onChange={onTitre} />}
        garder={
          <CaseACocher
            etiquette="Utiliser le titre adapté"
            coche={choix.title}
            onChange={(v) => onChoix({ ...choix, title: v })}
          />
        }
      />

      <Comparaison
        titre="Phrase de présentation"
        avant={<p className="whitespace-pre-wrap">{profil.summary || '—'}</p>}
        apres={
          <Champ etiquette="Phrase adaptée à l’annonce" multiligne lignes={4} valeur={accroche} onChange={onAccroche} />
        }
        garder={
          <CaseACocher
            etiquette="Utiliser la phrase adaptée"
            coche={choix.summary}
            onChange={(v) => onChoix({ ...choix, summary: v })}
          />
        }
      />

      {adapte.experiences.map((experience, i) => {
        const originale = profil.experiences[experience.sourceIndex ?? i]
        return (
          <Comparaison
            key={`${experience.sourceIndex ?? i}-${experience.position}-${experience.company}`}
            titre={`${experience.position} — ${experience.company}`}
            avant={
              <ul className="list-disc space-y-1 pl-5">
                {(originale?.achievements ?? []).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            }
            apres={
              <Champ
                etiquette="Ce que vous avez fait (une idée par ligne)"
                multiligne
                lignes={Math.max(4, (points[i]?.length ?? 0) + 1)}
                valeur={(points[i] ?? []).join('\n')}
                onChange={(v) => onPoints(points.map((x, j) => (j === i ? lignes(v) : x)))}
              />
            }
            garder={
              <CaseACocher
                etiquette="Utiliser les phrases choisies pour cette annonce"
                aide="Décochée : toutes vos phrases de départ sont reprises, dans leur ordre."
                coche={choix.experiences[i] ?? true}
                onChange={(v) => onChoix({ ...choix, experiences: remplacer(choix.experiences, i, v) })}
              />
            }
          />
        )
      })}

      <Comparaison
        titre="Compétences"
        avant={<p>{profil.skills.join(', ') || '—'}</p>}
        apres={<p className="text-corps text-encre">{competencesFinales.join(', ') || '—'}</p>}
        garder={
          <CaseACocher
            etiquette="Utiliser la sélection adaptée"
            aide="Les compétences utiles pour cette annonce, celles qu’elle demande en premier."
            coche={choix.skills}
            onChange={(v) => onChoix({ ...choix, skills: v })}
          />
        }
      />
    </div>
  )
}
