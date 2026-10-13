import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Experience, Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'
import { normaliser } from './texte'

// Réponse volontairement COMPACTE (sur CPU, le temps d'une étape est celui de la réponse). Pour les expériences
// et formations : un domaine de 2 à 4 mots, puis une note ; pour les compétences : la seule liste des indices utiles
// (au lieu d'un objet par compétence, ~15 fois plus long).
const noteSchema = z.object({
  indice: z.number(),
  domaine: z.string().max(40).default(''),
  pertinence: z.number(),
})

export const pertinenceSchema = z.object({
  experiences: z.array(noteSchema).default([]),
  formations: z.array(noteSchema).default([]),
  competencesUtiles: z.array(z.number()).default([]),
})

/** 0 = sans rapport avec le poste visé, 1 = transférable / général, 2 = directement lié. */
export type Niveau = 0 | 1 | 2

export interface Pertinence {
  experiences: Niveau[]
  formations: Niveau[]
  competences: Niveau[]
}

const SYSTEME = `Tu es un expert en recrutement. Tu aides un candidat à présenter honnêtement son parcours pour un poste précis.
Évalue les éléments du profil par rapport au poste visé et à ses exigences.

1. "experiences" et "formations" (identifiées par leur "indice") : pour chaque élément, un objet {"indice", "domaine", "pertinence"} :
- "domaine" : son domaine d'activité en 2 à 4 mots (ex. « développement web », « carrosserie automobile »). Deux expériences du même domaine reçoivent le même libellé ;
- "pertinence" : 2 = sert directement une activité ou une exigence de l'offre (même métier, mêmes outils) ; 1 = domaine voisin ou activités en partie communes, ou diplôme dont la spécialité n'est pas précisée ; 0 = domaine sans aucun lien avec l'offre (ex. mécanique ou artisanat pour un poste de communication numérique).
2. "competencesUtiles" : la liste des indices des compétences qui servent le poste visé (savoir-faire en lien avec l'offre et qualités professionnelles utiles dans ce poste). Les autres sont omises.

Juge uniquement d'après les données fournies.

${REGLES_ANTI_INVENTION}`

// Garde-fou : une note manquante, hors bornes ou non entière n'élimine jamais un élément (niveau neutre 1).
export function normaliserNiveaux(notes: { indice: number; pertinence: number }[], taille: number): Niveau[] {
  const niveaux: Niveau[] = Array.from({ length: taille }, () => 1)
  for (const { indice, pertinence } of notes) {
    if (!Number.isInteger(indice) || indice < 0 || indice >= taille || !Number.isFinite(pertinence)) continue
    niveaux[indice] = Math.min(2, Math.max(0, Math.round(pertinence))) as Niveau
  }
  return niveaux
}

/** Indices utiles → niveaux ; une liste vide ou entièrement invalide ne retire rien (niveau neutre partout). */
export function niveauxCompetences(utiles: number[], taille: number): Niveau[] {
  const valides = new Set(utiles.filter((i) => Number.isInteger(i) && i >= 0 && i < taille))
  if (valides.size === 0) return Array.from({ length: taille }, () => 1)
  return Array.from({ length: taille }, (_, i) => (valides.has(i) ? 1 : 0))
}

// Garde-fou de cohérence : deux expériences du même domaine (ou au même intitulé de poste) ne peuvent pas être
// pertinentes d'un côté et pas de l'autre (Webagence / Agence Pixel : « Développeur web front »).
// Chaque groupe prend la note la plus haute.
export function harmoniserExperiences(
  niveaux: Niveau[],
  experiences: Pick<Experience, 'poste'>[],
  domaines: string[] = [],
): Niveau[] {
  const cles = (i: number) =>
    [
      experiences[i] ? `poste:${normaliser(experiences[i].poste)}` : '',
      domaines[i] ? `domaine:${normaliser(domaines[i])}` : '',
    ].filter(Boolean)
  // On propage le maximum entre éléments partageant une clé, jusqu'à stabilité.
  const resultat = [...niveaux]
  for (let changement = true; changement; ) {
    changement = false
    const meilleur = new Map<string, Niveau>()
    for (let i = 0; i < resultat.length; i++) {
      for (const cle of cles(i)) meilleur.set(cle, Math.max(meilleur.get(cle) ?? 0, resultat[i] ?? 0) as Niveau)
    }
    for (let i = 0; i < resultat.length; i++) {
      const max = Math.max(resultat[i] ?? 0, ...cles(i).map((cle) => meilleur.get(cle) ?? 0)) as Niveau
      if (max !== resultat[i]) {
        resultat[i] = max
        changement = true
      }
    }
  }
  return resultat
}

const domaineProcheSchema = z.object({ choix: z.number() })

const SYSTEME_DOMAINE = `Tu es un expert en recrutement.
Le candidat n'a aucune expérience dans le métier visé. Parmi les domaines d'activité de son parcours (identifiés par leur "indice"), indique celui dont les activités sont les plus proches de celles du poste visé : c'est celui qui sera mis en avant dans son CV.
Réponds avec "choix" : l'indice du domaine le plus proche.

${REGLES_ANTI_INVENTION}`

// Repli quand aucune expérience n'a été jugée pertinente : plutôt que de tout garder (et de remettre en avant
// un métier sans aucun rapport), on demande un choix RELATIF, plus simple et plus stable qu'une note absolue.
async function domaineLePlusProche(
  moteur: MoteurLLM,
  analyse: AnalyseOffre,
  domaines: string[],
  experiences: Experience[],
): Promise<string | null> {
  const distincts = [...new Map(domaines.filter(Boolean).map((d) => [normaliser(d), d])).values()]
  if (distincts.length < 2) return null
  const liste = distincts.map((domaine, indice) => ({
    indice,
    domaine,
    postes: experiences.filter((_, i) => normaliser(domaines[i] ?? '') === normaliser(domaine)).map((e) => e.poste),
  }))
  const { choix } = await moteur.genererObjet({
    nom: 'domaineProche',
    schema: domaineProcheSchema,
    systeme: SYSTEME_DOMAINE,
    temperature: 0,
    utilisateur: `Poste visé : ${analyse.titreCible}\n${encadrer('profil', JSON.stringify(liste, null, 2))}`,
  })
  return Number.isInteger(choix) ? (distincts[choix] ?? null) : null
}

const MAX_REALISATIONS_ENVOYEES = 4
const MAX_CARACTERES_REALISATION = 140

// Étape 2 : pertinence de chaque élément du profil par rapport au poste visé (une seule requête).
export async function evaluerPertinence(moteur: MoteurLLM, profil: Profil, analyse: AnalyseOffre): Promise<Pertinence> {
  const { experiences, formations, competences } = profil
  if (experiences.length + formations.length + competences.length === 0) {
    return { experiences: [], formations: [], competences: [] }
  }
  // Entrée allégée : le jugement s'appuie sur l'intitulé et les premières réalisations, pas sur tout le CV.
  const contenu = {
    experiences: experiences.map((e, indice) => ({
      indice,
      poste: e.poste,
      realisations: e.realisations
        .slice(0, MAX_REALISATIONS_ENVOYEES)
        .map((r) => r.slice(0, MAX_CARACTERES_REALISATION)),
    })),
    formations: formations.map((f, indice) => ({ indice, diplome: f.diplome })),
    competences: competences.map((nom, indice) => ({ indice, nom })),
  }
  const exigences = [...analyse.competencesRequises, ...analyse.motsCles]
  const reponse = await moteur.genererObjet({
    nom: 'pertinence',
    schema: pertinenceSchema,
    systeme: SYSTEME,
    temperature: 0,
    utilisateur: `Poste visé : ${analyse.titreCible}\nActivités et exigences de l'offre :\n${exigences.map((e) => `- ${e}`).join('\n')}\n${encadrer('profil', JSON.stringify(contenu))}`,
  })
  const domaines = experiences.map((_, i) => reponse.experiences.find((n) => n.indice === i)?.domaine ?? '')
  const niveauxExperiences: Niveau[] = harmoniserExperiences(
    normaliserNiveaux(reponse.experiences, experiences.length),
    experiences,
    domaines,
  )
  // Aucune expérience jugée pertinente : on met en avant le domaine le plus proche plutôt que tout garder.
  if (experiences.length >= 2 && Math.max(0, ...niveauxExperiences) === 0) {
    const proche = await domaineLePlusProche(moteur, analyse, domaines, experiences)
    if (proche !== null) {
      domaines.forEach((d, i) => {
        if (normaliser(d) === normaliser(proche)) niveauxExperiences[i] = 1
      })
    }
  }
  return {
    experiences: niveauxExperiences,
    formations: normaliserNiveaux(reponse.formations, formations.length),
    competences: niveauxCompetences(reponse.competencesUtiles, competences.length),
  }
}

/**
 * Indices à conserver : tout sauf le niveau 0. Si rien ne survit (offre sans rapport avec aucun
 * élément, ou réponse du modèle incohérente), on garde tout plutôt que de produire une section vide.
 * `imposes` : indices toujours conservés (ex. compétence citée mot pour mot dans l'offre).
 */
export function indicesConserves(niveaux: Niveau[], imposes: ReadonlySet<number> = new Set()): number[] {
  const gardes = niveaux.map((_, i) => i).filter((i) => (niveaux[i] ?? 0) > 0 || imposes.has(i))
  return gardes.length > 0 ? gardes : niveaux.map((_, i) => i)
}
