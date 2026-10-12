import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Experience, Profil } from '../schemas'
import type { AnalyseOffre } from './motsCles'
import { normaliser } from './texte'

// L'ordre des champs compte : le modèle nomme le domaine, puis l'exigence de l'offre servie ("raison"),
// puis seulement note. Ces deux champs ne sont pas conservés.
const noteSchema = z.object({
  indice: z.number(),
  domaine: z.string().default(''),
  raison: z.string().default(''),
  pertinence: z.number(),
})

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

const SYSTEME = `Tu es un expert en recrutement. Tu aides un candidat à présenter honnêtement son parcours pour un poste précis.
Pour chaque élément du profil (expériences, formations, compétences, identifiés par leur "indice") :
1. "domaine" : le domaine d'activité de l'élément en 2 à 4 mots (ex. « développement web », « carrosserie automobile », « comptabilité »). Deux expériences du même domaine reçoivent le même libellé.
2. "raison" : en une phrase courte, ce que l'élément apporte aux activités ou exigences de l'offre (ou « aucun lien »).
3. "pertinence" :
- 2 : sert directement une activité ou une exigence de l'offre (même métier, mêmes outils, mêmes techniques) ;
- 1 : domaine voisin ou activités en partie communes avec l'offre (ex. gestion de site web, analyse de trafic ou rédaction web pour un poste de communication numérique), qualité professionnelle utile au poste, ou diplôme dont la spécialité n'est pas précisée ;
- 0 : domaine sans aucun lien avec l'offre (ex. mécanique, artisanat ou bâtiment pour un poste de communication numérique).
Juge uniquement d'après les données fournies.
Réponds avec "experiences", "formations" et "competences" : pour chacune, la liste d'objets {"indice", "domaine", "raison", "pertinence"}, un par élément fourni (le "domaine" peut rester vide pour une compétence).

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

// Garde-fou de cohérence : deux expériences du même domaine (ou au même intitulé de poste) ne peuvent pas
// être pertinentes d'un côté et pas de l'autre (Webagence / Agence Pixel : « Développeur web front »).
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
  // Union-find simplifiée : on propage le maximum entre éléments partageant une clé, jusqu'à stabilité.
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
  const exigences = [...analyse.competencesRequises, ...analyse.motsCles]
  const reponse = await moteur.genererObjet({
    nom: 'pertinence',
    schema: pertinenceSchema,
    systeme: SYSTEME,
    temperature: 0,
    utilisateur: `Poste visé : ${analyse.titreCible}\nActivités et exigences de l'offre :\n${exigences.map((e) => `- ${e}`).join('\n')}\n${encadrer('profil', JSON.stringify(contenu, null, 2))}`,
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
