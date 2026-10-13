import { nettoyerTitreOffre } from '../offre/texte'
import type { Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'
import { contientMot, normaliser, texteExperience } from './texte'

/**
 * Compétences demandées par l'offre, rapprochées du profil : c'est ce que cherche d'abord le recruteur (ou son ATS).
 * - `attestees` : déjà présentes dans le profil (compétences, expériences, titre) : on peut les afficher telles quelles ;
 * - `manquantes` : demandées mais absentes du profil. Le CV ne les ajoute JAMAIS de lui-même : c'est à l'utilisateur
 *   de dire s'il les maîtrise.
 */
export interface CouvertureOffre {
  attestees: string[]
  manquantes: string[]
}

// Mots d'introduction qui ne désignent pas la compétence elle-même (« Maîtrise de WordPress » → « WordPress »).
const MOTS_GENERIQUES = new Set([
  'maitrise',
  'maitriser',
  'connaissance',
  'connaissances',
  'experience',
  'experiences',
  'competence',
  'competences',
  'capacite',
  'capacites',
  'bonne',
  'bonnes',
  'excellente',
  'excellentes',
  'solide',
  'solides',
  'pratique',
  'sens',
  'aisance',
  'goût',
  'gout',
  'avec',
  'dans',
  'pour',
  'des',
  'les',
  'une',
  'aux',
  'sur',
])

const MAX_MANQUANTES = 12
const MAX_ATTESTEES = 12

function motsSignificatifs(terme: string): string[] {
  return (normaliser(terme).match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((mot) => !MOTS_GENERIQUES.has(mot))
}

const racine = (mot: string) => mot.slice(0, 5)

export function analyserCouverture(profil: Profil, analyse: AnalyseOffre): CouvertureOffre {
  const source = normaliser(
    [
      profil.titrePoste ?? '',
      profil.accroche ?? '',
      ...profil.competences,
      ...profil.experiences.map(texteExperience),
      ...profil.formations.map((f) => f.diplome),
    ].join('\n'),
  )
  const racinesSource = new Set((source.match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(racine))
  // L'intitulé du poste n'est pas une compétence à cocher (avec ou sans « (H/F) »).
  const titres = new Set([normaliser(analyse.titreCible), normaliser(nettoyerTitreOffre(analyse.titreCible))])

  const vus = new Set<string>()
  const termes = [...analyse.competencesRequises, ...analyse.motsCles]
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !titres.has(normaliser(t)))
    .filter((t) => {
      const cle = normaliser(t)
      if (vus.has(cle)) return false
      vus.add(cle)
      return true
    })

  const attestees: string[] = []
  const manquantes: string[] = []
  for (const terme of termes) {
    const mots = motsSignificatifs(terme)
    const couvert =
      contientMot(source, normaliser(terme)) ||
      (mots.length > 0 && mots.filter((m) => racinesSource.has(racine(m))).length / mots.length >= 0.75)
    ;(couvert ? attestees : manquantes).push(terme)
  }
  // Un terme générique inclus dans un terme plus précis de la liste (« audit » dans « audit sémantique ») n'apporte
  // rien : on garde le plus précis.
  const sansRedondance = (liste: string[]) =>
    liste.filter((t) => !liste.some((autre) => autre !== t && contientMot(normaliser(autre), normaliser(t))))
  return {
    attestees: sansRedondance(attestees).slice(0, MAX_ATTESTEES),
    manquantes: sansRedondance(manquantes).slice(0, MAX_MANQUANTES),
  }
}

/** Vrai si `terme` est déjà représenté par l'une des compétences listées (inclusion dans un sens ou l'autre). */
export function dejaListee(terme: string, competences: string[]): boolean {
  const t = normaliser(terme)
  return competences.some((c) => {
    const n = normaliser(c)
    return n === t || contientMot(n, t) || contientMot(t, n)
  })
}
