import { nettoyerTitreOffre } from '../offre/texte'
import type { Profile, Requirements } from '../schemas'
import type { AnalyseOffre } from './motsCles'
import { contientMot, normaliser, texteExperience } from './texte'

/**
 * Compétences demandées par l'offre, rapprochées du profil : c'est ce que cherche d'abord le recruteur (ou son ATS).
 * - `evidenced` : déjà présentes dans le profil (compétences, expériences, titre) : on peut les afficher telles quelles ;
 * - `missing` : demandées mais absentes du profil. Le CV ne les ajoute JAMAIS de lui-même : c'est à l'utilisateur
 *   de dire s'il les maîtrise.
 */
export interface CouvertureOffre {
  evidenced: string[]
  missing: string[]
  requirements: Requirements
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

export function analyserCouverture(profil: Profile, analyse: AnalyseOffre): CouvertureOffre {
  const source = normaliser(
    [
      profil.headline ?? '',
      profil.summary ?? '',
      ...profil.skills,
      ...profil.experiences.map(texteExperience),
      ...profil.education.map((f) => f.degree),
    ].join('\n'),
  )
  const racinesSource = new Set((source.match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(racine))
  // L'intitulé du poste n'est pas une compétence à cocher (avec ou sans « (H/F) »).
  const titres = new Set([normaliser(analyse.titreCible), normaliser(nettoyerTitreOffre(analyse.titreCible))])

  // Ni l'intitulé du poste (ou un morceau : « Chargé de sourcing » pour « Chargé de sourcing et de recrutement »),
  // ni le contexte du contrat : ce ne sont pas des compétences.
  const titreComplet = normaliser(nettoyerTitreOffre(analyse.titreCible))
  const estContexte = (t: string) => {
    const n = normaliser(t)
    return titres.has(n) || (n.length >= 6 && titreComplet.includes(n)) || CONTEXTE_CONTRAT.test(n)
  }

  const vus = new Set<string>()
  // Qualités et outils demandés dans le « profil recherché » d'abord : ce sont les exigences explicites.
  const explicites = new Set([...analyse.competencesRequises, ...analyse.qualites].map((t) => normaliser(t.trim())))
  const termes = [...analyse.competencesRequises, ...analyse.qualites, ...analyse.motsCles]
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !estContexte(t))
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
    if (couvert) {
      attestees.push(terme)
      continue
    }
    // Un mot-clé isolé non attesté (« stratégie », « entretien », « commercial ») est trop vague pour être proposé
    // comme compétence à ajouter ; seuls les outils et qualités explicitement demandés le sont.
    const motIsole = terme.split(/\s+/).length === 1
    // (Un nom d'outil s'écrit avec une majuscule ou des chiffres : « Ahrefs », « GA4 », « n8n » ne sont pas écartés.)
    const ressembleNomCommun = terme === terme.toLowerCase() && !/\d/.test(terme)
    if (motIsole && !explicites.has(normaliser(terme)) && ressembleNomCommun) continue
    manquantes.push(terme)
  }
  // Un terme générique inclus dans un terme plus précis de la liste (« audit » dans « audit sémantique ») n'apporte
  // rien : on garde le plus précis.
  const sansRedondance = (liste: string[]) =>
    liste.filter((t) => !liste.some((autre) => autre !== t && contientMot(normaliser(autre), normaliser(t))))
  return {
    evidenced: sansRedondance(attestees).slice(0, MAX_ATTESTEES),
    missing: sansRedondance(manquantes).slice(0, MAX_MANQUANTES),
    requirements: evaluerPrerequis(profil, analyse, source),
  }
}

// Mots de contexte (contrat, remplacement…) que le modèle range parfois parmi les « mots-clés ».
const CONTEXTE_CONTRAT =
  /^(remplacement|cdi|cdd|interim|intérim|stage|alternance|temps (plein|partiel)|teletravail|télétravail|poste (a|à) pourvoir|poste base|deplacements?|déplacements?|reseaux? commerciaux?|secteur [\p{L} ]+)$/iu

/** Niveau d'études « équivalent Bac + N » d'un texte (« Bac +3 à Bac +5 » → 3, « Master » → 5), sinon null. */
export function niveauEtudes(texte: string): number | null {
  const t = normaliser(texte)
  const bac = t.match(/bac\s*\+\s*(\d)/)
  if (bac?.[1]) return Number(bac[1])
  if (/\b(master|ingenieur|m2|doctorat)\b/.test(t)) return 5
  if (/\b(licence|bachelor|l3|but)\b/.test(t)) return 3
  if (/\b(bts|dut|deust|l2)\b/.test(t)) return 2
  if (/\bbac\b/.test(t)) return 0
  return null
}

function evaluerPrerequis(profil: Profile, analyse: AnalyseOffre, source: string): Requirements {
  const resultat: Requirements = {}

  if (analyse.formationRequise.trim() !== '') {
    const exige = niveauEtudes(analyse.formationRequise)
    const niveaux = profil.education.map((f) => niveauEtudes(f.degree)).filter((n): n is number => n !== null)
    const meilleur = niveaux.length > 0 ? Math.max(...niveaux) : null
    const diplome =
      meilleur === null ? undefined : profil.education.find((f) => niveauEtudes(f.degree) === meilleur)?.degree
    resultat.education = {
      required: analyse.formationRequise,
      status: exige === null || meilleur === null ? 'unknown' : meilleur >= exige ? 'ok' : 'insufficient',
      profileValue: diplome,
    }
  }

  if (analyse.experienceRequise.trim() !== '') {
    // Domaine de l'expérience demandée : on retire durée et mots d'introduction, il reste « recrutement, sourcing… ».
    const domaine = motsSignificatifs(analyse.experienceRequise).filter(
      (m) => m.length >= 5 && !/^(minimum|annees?|ans?|experience|environnement|idealement|poste|similaire)$/.test(m),
    )
    const racinesSource = new Set((source.match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(racine))
    resultat.experience = {
      required: analyse.experienceRequise,
      status: domaine.some((m) => racinesSource.has(racine(m))) ? 'found' : 'not-found',
    }
  }
  return resultat
}

/** Vrai si `terme` est déjà représenté par l'une des compétences listées (inclusion dans un sens ou l'autre). */
export function dejaListee(terme: string, competences: string[]): boolean {
  const t = normaliser(terme)
  return competences.some((c) => {
    const n = normaliser(c)
    return n === t || contientMot(n, t) || contientMot(t, n)
  })
}
