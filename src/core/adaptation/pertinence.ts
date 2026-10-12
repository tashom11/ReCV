import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'

const noteSchema = z.object({ indice: z.number(), pertinence: z.number() })

export const pertinenceSchema = z.object({
  experiences: z.array(noteSchema).default([]),
  formations: z.array(noteSchema).default([]),
  competences: z.array(noteSchema).default([]),
})

/** 0 = sans rapport avec le poste visé, 1 = transférable / général, 2 = directement lié. */
export type Niveau = 0 | 1 | 2

export interface Pertinence {
  experiences: Niveau[]
  formations: Niveau[]
  competences: Niveau[]
}

const SYSTEME = `Tu es un expert en recrutement.
Pour chaque élément du profil (expériences, formations, compétences, identifiés par leur "indice"), évalue sa pertinence pour le poste visé, décrit par son intitulé et ses mots-clés :
- 2 : directement lié au poste (même métier, mêmes outils ou techniques, domaine proche) ;
- 1 : utile ou transférable (qualités professionnelles générales, polyvalence, compétences communes à plusieurs métiers) ;
- 0 : sans rapport avec le poste (autre métier ou autre domaine, sans lien avec les missions de l'offre).
Un élément qui relève d'un autre domaine que le poste visé reçoit 0, même s'il est valorisant. Juge uniquement d'après les données fournies.
Réponds avec "experiences", "formations" et "competences" : pour chacune, la liste d'objets {"indice", "pertinence"}, un par élément fourni.

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

// Étape 2 : pertinence de chaque élément du profil par rapport au poste visé (une seule requête).
export async function evaluerPertinence(moteur: MoteurLLM, profil: Profil, analyse: AnalyseOffre): Promise<Pertinence> {
  const { experiences, formations, competences } = profil
  if (experiences.length + formations.length + competences.length === 0) {
    return { experiences: [], formations: [], competences: [] }
  }
  const contenu = {
    experiences: experiences.map((e, indice) => ({
      indice,
      poste: e.poste,
      entreprise: e.entreprise,
      description: e.description,
      realisations: e.realisations,
    })),
    formations: formations.map((f, indice) => ({ indice, diplome: f.diplome, etablissement: f.etablissement })),
    competences: competences.map((nom, indice) => ({ indice, nom })),
  }
  const reponse = await moteur.genererObjet({
    nom: 'pertinence',
    schema: pertinenceSchema,
    systeme: SYSTEME,
    utilisateur: `Poste visé : ${analyse.titreCible}\nMots-clés de l'offre : ${analyse.motsCles.join(', ')}\n${encadrer('profil', JSON.stringify(contenu, null, 2))}`,
  })
  return {
    experiences: normaliserNiveaux(reponse.experiences, experiences.length),
    formations: normaliserNiveaux(reponse.formations, formations.length),
    competences: normaliserNiveaux(reponse.competences, competences.length),
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
