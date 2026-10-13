import { z } from 'zod'
import type { MoteurLLM } from '../llm/moteur'
import { encadrer, REGLES_ANTI_INVENTION } from '../llm/prompts'
import type { Profil } from '../schemas'
import { borneAccroche } from './pipeline'
import { pointFidele } from './reecriture'
import { contientMot, normaliser, texteExperience } from './texte'

// Bornes minimales : avec une grammaire JSON, un modèle peut sinon répondre par la sortie la plus courte
// valide (« [] » et « "" »). `min` les exclut de la grammaire elle-même.
export const accrocheProfilSchema = z.object({
  competencesTransversales: z.array(z.string().min(2)).min(1),
  accroche: z.string().min(15),
})

const SYSTEME = `Tu es un expert en rédaction de CV.
À partir du profil fourni :
1. "competencesTransversales" : les compétences transversales du candidat, c'est-à-dire les savoir-être et qualités professionnelles utiles dans n'importe quel métier (rigueur, autonomie, organisation, communication, travail en équipe, adaptabilité, sens du détail, respect des délais, relation client, gestion de projets…). Recopie-les telles qu'elles figurent dans le profil. Exclus toute compétence propre à un métier : outils, logiciels, langages, techniques, diplômes.
2. "accroche" : 2 à 3 phrases (400 caractères maximum), sans sujet explicite (ni « je », ni « le candidat », ni « il » : par exemple « Rigoureux et autonome, sait organiser… »), qui présentent le candidat uniquement par ces compétences transversales, pour qu'elle reste valable quelle que soit l'offre visée. Ne cite aucun métier, intitulé de poste, outil, technologie, employeur, secteur d'activité, durée ni chiffre.

${REGLES_ANTI_INVENTION}`

export const MESSAGE_AUCUNE_COMPETENCE =
  'Aucune compétence transversale repérée dans ton profil. Ajoute-en (rigueur, autonomie, organisation, communication…) dans « Compétences » ou dans les réalisations, puis réessaie.'

// Mots neutres qu'une accroche peut employer sans qu'ils figurent dans le profil.
const MOTS_NEUTRES = new Set([
  'professionnel',
  'professionnelle',
  'professionnels',
  'profil',
  'candidat',
  'candidate',
  'capable',
  'alliant',
  'allie',
  'solide',
  'solides',
  'grande',
  'grandes',
  'forte',
  'fortes',
  'bonne',
  'bonnes',
  'serieux',
  'serieuse',
  'qualites',
  'qualite',
  'competences',
  'capacite',
  'capacites',
  'esprit',
  'savoir',
  'atouts',
  'permettent',
  'permet',
  'assurer',
  'garantir',
  'favorise',
  'favoriser',
  'toujours',
  'ainsi',
  'notamment',
  'situations',
  'contextes',
  'environnement',
  'environnements',
  'quotidien',
  'efficace',
  'efficacement',
  'mission',
  'missions',
  'projets',
  'equipe',
  'equipes',
  'tache',
  'taches',
  // Verbes et compléments courants d'une phrase de présentation (aucun ne décrit une qualité).
  'nouveaux',
  'nouvelles',
  'nouveau',
  'nouvelle',
  'resultats',
  'attentes',
  'exigences',
  'objectifs',
  'parties',
  'prenantes',
  'collaborer',
  'collaboration',
  'repondre',
  'repond',
  'maitrise',
  'maitrisant',
  'adapter',
  'rapidement',
  'rapide',
  'contribuer',
  'contribue',
  'atteindre',
  'permettant',
  'permettre',
  'garantissant',
  'assurant',
  'assure',
  'gerer',
  'gestion',
  'allie',
  'alliance',
  'respect',
  'delais',
  'clients',
  'interlocuteurs',
  'fonctionnement',
  'efficacite',
  'travailler',
  'evoluer',
  'apporte',
  'apportant',
  'interne',
  'internes',
  'externes',
  'diverses',
  'variees',
  'differents',
  'differentes',
])

// Racine grossière pour rapprocher « rigoureux » de « Rigueur », « autonome » de « Autonomie »…
function racine(mot: string): string {
  return mot.replace(/^rigoureu/, 'rigueu').slice(0, 5)
}

function mots(texte: string): string[] {
  return normaliser(texte).match(/\p{L}{5,}/gu) ?? []
}

/**
 * Mots significatifs de l'accroche qui n'ont aucun équivalent dans le profil (ni mot neutre) : un tel mot est
 * une qualité ou une notion que le modèle a ajoutée (« Leader visionnaire »), donc une invention.
 */
export function motsNonAttestes(accroche: string, source: string): string[] {
  const racinesSource = new Set(mots(source).map(racine))
  return mots(accroche).filter((mot) => !MOTS_NEUTRES.has(mot) && !racinesSource.has(racine(mot)))
}

// « a, b et c »
function enumerer(elements: string[]): string {
  if (elements.length <= 1) return elements.join('')
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`
}

function texteSource(profil: Profil): string {
  return [
    profil.accroche ?? '',
    ...profil.competences,
    ...profil.experiences.map(texteExperience),
    ...profil.experiences.map((e) => e.periode ?? ''),
  ].join('\n')
}

/**
 * Accroche générique fondée sur les seules compétences TRANSVERSALES du profil : elle ne cite aucun savoir-faire
 * de métier, qui pourrait ne pas correspondre aux offres visées. Le modèle propose, le code vérifie :
 * - une compétence n'est retenue que si elle figure mot pour mot dans le profil ;
 * - l'accroche est rejetée si elle cite une compétence de métier, un poste, un employeur ou un chiffre ;
 * - sinon, repli sur une phrase composée uniquement des compétences retenues.
 */
export async function genererAccrocheProfil(moteur: MoteurLLM, profil: Profil): Promise<string> {
  const contenu = {
    competences: profil.competences,
    realisations: profil.experiences.flatMap((e) => [e.description ?? '', ...e.realisations]).filter(Boolean),
    accrocheActuelle: profil.accroche,
  }
  const reponse = await moteur.genererObjet({
    nom: 'accrocheProfil',
    schema: accrocheProfilSchema,
    systeme: SYSTEME,
    utilisateur: encadrer('profil', JSON.stringify(contenu, null, 2)),
  })

  const source = texteSource(profil)
  const sourceNormalisee = normaliser(source)
  const retenues = [...new Set(reponse.competencesTransversales.map((c) => c.trim()).filter(Boolean))].filter((c) =>
    contientMot(sourceNormalisee, normaliser(c)),
  )
  if (retenues.length === 0) throw new Error(MESSAGE_AUCUNE_COMPETENCE)

  const retenuesNormalisees = new Set(retenues.map(normaliser))
  const interdits = [
    ...profil.competences.filter((c) => !retenuesNormalisees.has(normaliser(c))),
    ...profil.experiences.flatMap((e) => [e.poste, e.entreprise]),
    ...(profil.titrePoste ? [profil.titrePoste] : []),
  ].filter((terme) => terme.trim().length >= 3)

  const proposee = borneAccroche(reponse.accroche)
  const valide =
    proposee !== '' &&
    !/\d/.test(proposee) &&
    pointFidele(proposee, source, interdits) &&
    motsNonAttestes(proposee, source).length === 0
  if (valide) return proposee
  return `Professionnel alliant ${enumerer(retenues.slice(0, 5).map((c) => c.toLowerCase()))}.`
}
